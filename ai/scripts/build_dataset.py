"""Consolidate raw SMS sources into a single labeled Ham/Spam/Scam dataset.

Sprint 2 Track B (AI/ML) — prerequisite for fine-tuning (WBS 2.3.4).

Sources (under ``ai/datasets/bantAI-datasets/``):
  * ``Kaggle/SCAM_MESSAGES_COMBINED.csv`` — THREE merged corpora, all stamped
    ``scam`` at source. Per the manuscript (p177) two of them ("PH Spam +
    Marketing SMS" -> ``SPAM_SMS``, "Tagalog-SMS" -> ``tagalog-sms``) were
    included *precisely because* they carry legitimate messages and marketing
    alongside scams, so their blanket ``scam`` stamp cannot be trusted. Only
    ``text-messages`` ("Philippine Spam/Scam SMS") is a genuine scam corpus.
  * ``NTC/FOI-TEST-DATASET.csv``          — citizen reports of *suspected* scams
                                            (NTC/CICC). Mostly real smishing,
                                            but people also report legitimate
                                            marketing and telco notices.
  * ``Raw/PHONE-SMS-INBOX*.csv``          — real phone-inbox exports, UNLABELED.

Labels come from transparent rules aligned with ``datasets/LABELING_GUIDE.md``
(judge by *intent*: deception -> Scam, selling -> Spam, otherwise -> Ham). Every
row carries its source, confidence and reason so a human can review the
uncertain ones instead of labeling 15k messages from scratch.

Source-labeled rows are only overridden on POSITIVE evidence (an anti-scam
advisory, an official-domain notice, a clear sales pitch). When the rules find
nothing, the original ``scam`` stands but drops to low confidence and lands in
the review file — so a real scam is never silently downgraded to Ham.

Outputs:
  * ``labeled/bantai_labeled.csv``       — training input (text,label,+metadata)
  * ``audit/bantai_labeled_full.csv``    — full audit trail, all occurrences
  * ``audit/needs_review.csv``           — low-confidence rows to eyeball first
  * ``audit/label_changes.csv``          — every row whose label differs from
                                           its source stamp, with the reason

Run:  cd ai && python -m scripts.build_dataset      (or python scripts/build_dataset.py)

Set ``BANTAI_OUT_ROOT`` to redirect the outputs elsewhere (used when the repo
checkout is read-only); inputs are always read from ``ai/datasets``.
"""

from __future__ import annotations

import csv
import glob
import io
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
# So `import preprocessing` (ai/preprocessing/) and `import apply_review_corrections`
# (its sibling in scripts/) both resolve regardless of cwd or invocation style --
# `python scripts/build_dataset.py` already puts HERE on sys.path automatically,
# but `python -m scripts.build_dataset` (also documented above) does not, so
# both are inserted explicitly rather than relying on the automatic behaviour.
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..")))
sys.path.insert(0, HERE)
DATASETS = os.environ.get("BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets")))
SRC = os.path.join(DATASETS, "bantAI-datasets")
# Only the training CSV goes in labeled/ -- the loader globs labeled/*.csv, so
# audit/review files must live elsewhere or they'd be concatenated in and
# double-count rows.
OUT_ROOT = os.environ.get("BANTAI_OUT_ROOT", DATASETS)
OUT = os.path.join(OUT_ROOT, "labeled")
AUDIT = os.path.join(OUT_ROOT, "audit")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


# --------------------------------------------------------------------------- #
# 0. Obfuscation normalizer.
#
# Scammers defeat plain keyword lists with character swaps ('dep0sit', 'b0nu5',
# 'cI@im') and letter-spaced branding ('G C A S H'). Every matcher below is run
# against the raw text AND this normalized view, never instead of it -- so terms
# that legitimately contain digits ('177bet', 'buy 1', '% off') keep matching.
# --------------------------------------------------------------------------- #

_LEET = str.maketrans(
    {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "|": "l", "!": "i"}
)

_SPACED = re.compile(r"\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b")


def deleet(text: str) -> str:
    """'dep0sit' -> 'deposit', 'G C A S H' -> 'GCASH'."""
    return _SPACED.sub(lambda m: m.group(0).replace(" ", ""), text or "").translate(_LEET)


# --------------------------------------------------------------------------- #
# Lexicons (lowercase). Grounded in the actual data, not generic guesses.
# --------------------------------------------------------------------------- #

# Legit PH senders + official domains -> a link/brand here is NOT a scam signal.
OFFICIAL_DOMAINS = {
    "globe.com.ph",
    "new.globe.com.ph",
    "glbe.co",
    "globeone.onelink.me",
    "gcash.com",
    "go.gcash.com",
    "dito.ph",
    "app.dito.ph",
    "digital.dito.ph",
    "smart.com.ph",
    "smrt.ph",
    "suncellular.com.ph",
    "my.suncellular.com.ph",
    "watsons.com.ph",
    "gogoxpress.com",
    "krispykreme.com.ph",
    "now.krispykreme.com.ph",
    "unionbankph.com",
    "bpi.com.ph",
    "shp.ee",
    "laco.st",
    "grab.com",
    "foodpanda.ph",
    "zalora.com.ph",
    "accounts-business.globe.com.ph",
    "phlpost.gov.ph",
    "metrobank.com.ph",
    "maya.ph",
    "paymaya.com",
    "mayaph.co",
    "jtexpress.ph",
    "lbcexpress.com",
    "shopee.ph",
    "lazada.com.ph",
    "lzd.co",
    "bdo.com.ph",
    "online.bdo.com.ph",
    "landbank.com",
    # Service/utility domains that appear in genuine transactional and
    # service-notice SMS (human review round 3: these were being treated as
    # "unverified links" and pushing legitimate notices into Spam).
    "pldthome.com",
    "pldt.com.ph",
    "smart.com.ph",
    "nnj.vn",
    "ninjavan.co",
    "smsupermalls.com",
    "palawanpawnshop.com",
    "cebuanalhuillier.com",
    "meralco.com.ph",
    "converge.com.ph",
    "skycable.com",
}

# Registrar-restricted Philippine TLDs. Unlike .com/.ph, these cannot be
# casually registered: dotPH requires documentary proof to issue one --
# agency endorsement for .gov.ph, CHED/DepEd accreditation for .edu.ph. A link
# on one of these is therefore strong positive evidence of a genuine
# institution (DOH advisories, BSP consumer notices, school announcements),
# not something a scammer can stand up cheaply. Treated as trusted suffixes
# rather than enumerating every agency and university in the country.
TRUSTED_TLD_SUFFIXES = ("gov.ph", "edu.ph", "gov", "mil")

# Generic URL shorteners. Deliberately NOT trusted -- scams use bit.ly heavily
# -- but their presence is not *evidence of impersonation* either, because
# legitimate PH brands run nearly every SMS campaign through one. Used only to
# stop "brand named + link isn't on the brand's domain" from firing on real
# marketing (human review round 4; see Bug History §10).
SHORTENERS = {
    "bit.ly",
    "bitly.com",
    "tinyurl.com",
    "goo.gl",
    "ow.ly",
    "t.co",
    "buff.ly",
    "rebrand.ly",
    "cutt.ly",
    "s.id",
    "linktr.ee",
    "lnk.to",
    "onelink.me",
    "page.link",
    "app.link",
    "smart.link",
    "eej.at",
}

# Throwaway / abuse-heavy TLDs. A brand name beside a link on one of these is
# impersonation regardless of how the message is phrased -- no legitimate
# Philippine brand runs a campaign on .tk or .icu.
SCAMMY_TLDS = {
    "tk",
    "ml",
    "ga",
    "cf",
    "gq",
    "xyz",
    "icu",
    "bid",
    "top",
    "win",
    "vip",
    "sbs",
    "cfd",
    "quest",
    "monster",
    "click",
    "rest",
    "bar",
    "beauty",
    "cyou",
    "makeup",
    "mom",
    "lol",
    "boats",
    "autos",
    "tw",
    "ru",
    "su",
}

# Brand -> the domains that brand is actually allowed to link to. A message that
# invokes the brand but links somewhere else is impersonation (see below).
BRAND_DOMAINS = {
    "gcash": {"gcash.com", "go.gcash.com"},
    "globe": {"globe.com.ph", "new.globe.com.ph", "glbe.co", "globeone.onelink.me", "accounts-business.globe.com.ph"},
    "smart": {"smart.com.ph", "smrt.ph"},
    "bdo": {"bdo.com.ph", "online.bdo.com.ph"},
    "bpi": {"bpi.com.ph"},
    "maya": {"maya.ph", "mayaph.co", "paymaya.com"},
    "paymaya": {"maya.ph", "mayaph.co", "paymaya.com"},
    "unionbank": {"unionbankph.com"},
    "metrobank": {"metrobank.com.ph"},
    "landbank": {"landbank.com"},
    "dito": {"dito.ph", "app.dito.ph", "digital.dito.ph"},
    "shopee": {"shopee.ph", "shp.ee"},
    "lazada": {"lazada.com.ph"},
    "lbc": {"lbcexpress.com"},
    "phlpost": {"phlpost.gov.ph"},
}

BRAND_SENDERS = {
    "globe",
    "smart",
    "dito",
    "tm",
    "tnt",
    "sun",
    "8080",
    "3733",
    "4438",
    "globereward",
    "globerewards",
    "ditoreward",
    "ditorewards",
    "autoloadmax",
    "lazada",
    "shopee",
    "watsons",
    "jollibee",
    "grab",
    "foodpanda",
    "krispykreme",
    "zalora",
    "gcash",
    "maya",
    "gogoxpress",
    "look list",
}

# Anti-scam public-service advisories. Telcos and banks send these constantly
# (manuscript p15). They are wall-to-wall scam vocabulary by nature, so they MUST
# be matched before any scam rule or they get labeled as the thing they warn
# about -- which would teach the model that safety education is an attack.
PSA = [
    "stopscam",
    "stop scam",
    "beware of sms scam",
    "beware of scam",
    "beware of sms scams",
    "mag-ingat sa scam",
    "mag ingat sa scam",
    "these are scams",
    "will never ask for your otp",
    "will not ask for your otp",
    "never ask for your otp",
    "hindi hihingin",
    "hindi magpapadala",
    "wag ibigay ang otp",
    "huwag ibigay ang otp",
    "do not share your otp",
    "never share your otp",
    "don't click links",
    "dont click links",
    "wag i-click ang link",
    "huwag i-click",
    "will not send links",
    "hindi nagpapadala ng link",
    "aim to steal your money",
    "never log into your",
    "always use the official",
    # Warning-style PSAs. The list above is phrased around OTPs and links, so
    # telco fraud warnings on other topics ("New SCAM Alert! Watch out for
    # unauthorized SIM card dealers...") had no match and were being labeled
    # Spam on the strength of the brand link they carry. Found 2026-07-29 while
    # spot-checking medium-confidence rows.
    "scam alert",
    "fraud alert",
    "watch out for unauthorized",
    "watch out for fake",
    "report it to",
    "verify only through",
    "official channels only",
    "huwag maniwala",
    "iwasan ang scam",
    # Security *education* -- messages explaining what smishing is, or warning
    # subscribers about it in Taglish. Round 4 caught two of these labeled
    # Scam/Spam: the rule set could recognise a warning about OTPs but not a
    # warning about phishing in general, so the very messages teaching users to
    # spot scams were being trained on as scams.
    "scam yan",
    "scam iyan",
    "sms phishing is",
    "smishing is",
    "legit sources will never",
    "legitimate sources will never",
    "pretends to be from",
    "trick you into",
    "giving away personal information",
    "nanghihingi ng personal info",
    "hindi kami humihingi",
    "never ask you to click",
    "will never ask you",
    # "SCAM 'YAN!" -- the apostrophe before "yan" made this miss the plain
    # "scam yan" entry above (substring match, so "scam 'yan" != "scam yan").
    # Found 2026-07-30: a DSWD/SSS ayuda anti-scam advisory was falling through
    # to the phishing+action rule ("i-verify" + "otp" both appear in the body,
    # ironically as safety advice) instead of being caught here first.
    "scam 'yan",
    "scam 'iyan",
]

# Promotional intent -> Spam (honest selling).
PROMO_TERMS = [
    "promo",
    "sale",
    "% off",
    "discount",
    "voucher",
    "register to",
    "unli",
    "for all sites",
    "new arrival",
    "download the app",
    "reward points",
    "subscribe",
    "libreng subscription",
    "avail",
    "exclusive offer",
    "flash sale",
    "vouchers up to",
    "buy 1",
    "buy one",
    "free shipping",
    "cashback",
    "big sale",
    "limited offer",
    "shop now",
    # Real-estate / product / service advertising (the pre-2022 Kaggle rows).
    "for sale",
    "pre-selling",
    "preselling",
    "for inquiries",
    "inquiries are welcome",
    "reply with your name",
    "pls reply w",
    "please reply w",
    "text your email",
    "send name",
    "now available",
    "units available",
    "lease to own",
    "for details pls reply",
    "open house",
    "showroom",
    "staycation",
    "book now",
    "reserve now",
    "sqm",
    "0% interest",
    "no dp",
    "installment",
    "if interested to buy",
    "sms for inquiries",
    "pls. reply",
    "please reply",
    "name & email",
    "name and email",
    "per person",
    "for details",
    "inquiries",
    "for more details",
    # Telco/bank offer phrasing. Human review round 4 found these falling all
    # the way through to the Ham default because the list above is written
    # around retail and real-estate wording -- an SMS selling a data bundle or
    # a loan says none of it. These are the highest-volume Spam shape in the
    # corpus, so the gap mattered (Bug History §11).
    "for only p",
    "only for p",
    "for p99",
    "valid for",
    "get free",
    "free data",
    "and other offers",
    "other offers",
    "as low as",
    "interest rate",
    "apply now",
    "apply using",
    "apply thru",
    "apply through",
    "enjoy free",
    "enjoy unli",
    "enjoy up to",
    "get up to",
    "grab your",
    "load and get",
    "top up and get",
    "subscribe to",
    "register now",
    "switch to",
    "upgrade to",
    "upgrade your account",
    "claim your free",
    "personal loan",
    "credit card",
    "cash loan offer",
    "loan offer",
    "data promo",
    "surf promo",
    "call and text promo",
    # Regulatory citation + honest-marketing opt-out boilerplate. Round 7
    # backlog review: 289 Globe/DITO/GCash loyalty-program messages (raffle
    # entries, rewards points, VoLTE/VoWiFi education) were defaulting to Ham
    # because PROMO_TERMS is written around retail/telco-offer wording, not
    # loyalty-program phrasing. Scammers essentially never cite a real DTI
    # permit number or offer a working STOP short-code, so these are safe,
    # general honest-promo signals rather than one-off campaign names. This
    # doesn't chase every specific brand/app name -- ~57% of that backlog is
    # covered by this, and the rest is low-stakes (mislabeling an honest promo
    # as Ham instead of Spam doesn't affect scam-catching).
    "dti fair trade permit",
    "dti permit no",
    "per dti",
    "no advisories?",
    "to unsubscribe",
    "text stop to",
    "stop txt",
    "reply stop",
    "text off to",
    "rewards points",
    "reward points",
    "raffle entries",
    "redeem rewards",
    "globe rewards",
    "volte",
    "vowifi",
]

# Tagalog / Taglish selling vocabulary. PROMO_TERMS above is almost entirely
# English, so Filipino-language marketing ("May PHP 15 bonus ka sa GCash dahil
# nag-cash in ka", "Sulit mag-ipon sa GSave") hit no promo rule and fell through
# to the Ham default -- which is why Tagalog Spam was near-zero. These run after
# every scam rule (see ``label_raw``), so gambling and phishing still win.
PROMO_TL = [
    # Savings / wallet / cash-in pitches.
    "mag-ipon",
    "mag ipon",
    "mag-cash in",
    "mag cash in",
    "nag-cash in",
    "cash in ng",
    "mag-load",
    "magpa-load",
    "sulit",
    # Earning / apply-now pitches from legitimate lenders and services.
    "mag-apply",
    "mag apply",
    "pwede ka mag",
    "puwede ka mag",
    "kumita ng",
    "makakuha ng",
    "makuha ito",
    "makatanggap ng",
    # Price / discount language.
    "diskwento",
    "abot-kaya",
    "abot kaya",
    "murang",
    "bumili ng",
    "bilhin",
    "tipid",
    "piso deal",
    "halagang",
    "worth p",
    "simula sa p",
    # Free-with-purchase offers (distinct from "libreng pera" gambling bait,
    # which GAMBLING_SOFT already owns).
    "libreng load",
    "libreng data",
    "libreng gb",
    "libreng regalo",
    "libreng delivery",
    "libre ang delivery",
    # Retail / availability.
    "suking tindahan",
    "mga tindahan",
    "available na",
    "bagong labas",
    "i-download ang app",
    "i-check ang app",
    "bisitahin ang",
]

# Legitimate recruitment ads. Unsolicited promotion of a service -> Spam.
# (Distinct from JOB_SCAM below, which is "earn 5000/day from home" bait.)
JOB_AD = [
    "can start asap",
    "bachelors degree",
    "bachelor's degree",
    "with related exp",
    "knowledgeable in",
    "we are hiring",
    "hiring for",
    "job opening",
    "now hiring",
    "written & spoken proficiency",
    "midshift",
    "shifting schedule",
    "w/ related exp",
]

# Deceptive intent -> Scam. Kept precise: bare tokens like "bet"/"spin" are
# avoided (they match inside "alphabet"/"inspiring" and legit reward promos).
#
# GAMBLING_HARD = unambiguous gambling *operators and mechanics*. These are
# offshore, unlicensed, and reach users through the same blasting infrastructure
# as smishing, so they fire on their own.
GAMBLING_HARD = [
    "casino",
    "jackpot",
    "jili",
    "epicwin",
    "177bet",
    "1xbet",
    "geniepot",
    "epic member",
    "sports betting",
    "online casino",
    "bet now",
    "free spin",
    "spin now",
    # Operator brands actually present in the corpus.
    "lawinplay",
    "panaloka",
    "pwin",
    "sbet",
    "gjp",
    "w19 games",
    "ph365",
    "epwin",
    "jilivip",
    "winningplus",
    "gojackpot",
    "winxtra",
    "coin33",
    "pin77",
    "pin 77",
    # Age-gate + "keep it fun" responsible-gambling boilerplate. Offshore
    # betting blasts wear it to look licensed; nothing else in an SMS says it.
    "21+ only",
    "18+ only",
    "keep it fun",
    "play responsibly",
    # Deposit/top-up reward mechanics. Surfaced by human review as a recurring
    # blast template the earlier list missed ("100% cash bonus for depositing
    # every day", "Top up and get 100% top up discount", "Magdeposito sa BW777
    # at makakuha ng 5% na bonus"). Legitimate PH retail does not pay you a
    # percentage for funding a balance.
    "cash bonus",
    "daily bonus",
    "bonus upto",
    "bonus up to",
    "top up discount",
    "top-up discount",
    "for depositing",
    "magdeposito",
    "mag-deposito",
    "i-deposito",
    "bw777",
    "cc6 member",
    # Illegal e-sabong.
    "e-sabong",
    "esabong",
    "sabong",
    # Deposit/slot mechanics -- no legitimate PH brand uses these.
    "slot bonus",
    "deposit bonus",
    "first deposit",
    "no deposit",
    "top-up bonus",
    "free chips",
    "lucky wheel",
    "welcome bonus",
    "rebate",
]

# GAMBLING_SOFT = vocabulary that legitimate telco promos DO use ("panalo ka!",
# "maglaro"). Needs a suspicious link or a second soft hit before it counts.
GAMBLING_SOFT = [
    "tumaya",
    "maglaro",
    "magparehistro",
    "magrehistro",
    "libreng pera",
    "panalo",
    "bigcash",
    "cash out",
    "withdraw",
    "red envelope",
    "daily login",
    "free bonus",
    "manalo",
]

# WIN_SCAM = lottery/prize-win phrasing that legit telco promos essentially
# never use -> Scam even without a link.
WIN_SCAM = [
    "you won",
    "you have won",
    "you've won",
    "you are a winner",
    "lucky winner",
    "lucky winners",
    "gcash prize",
    "cash prize",
    "claim your prize",
    "you have been selected",
    "congratulations you",
    "winners list",
    "maswerteng nanalo",
    "waiting in your account",
    # Prize-collection urgency and spin/roulette bait -- from human review of
    # the low-confidence sample (see review_sheet.csv), these were falling
    # through to the Ham default because they don't use the English phrasing
    # above.
    "napanalunan",
    "kolektahin ito",
    "spin to win",
    "lucky roulette",
    "premyo ngayon",
]
# PROMO_BAIT = "claim/redeem/freebie/bonus" language that legit brands DO use.
# Promotional on its own (-> Spam); only Scam when paired with a suspicious link
# or a brand-domain mismatch.
PROMO_BAIT = [
    "claim now",
    "redeem your",
    "welcome bonus",
    "deposit bonus",
    "free bonus",
    "first bonus",
    "free gift",
    "reward will expire",
    "win big",
    "freebie",
    "selected as",
    # Points-expiry phishing template (the Globe/Smart/Metrobank fakes).
    "points will expire",
    "points expire",
    "will expire today",
    "expiring today",
    "expire today",
    "permanently forfeited",
    "redeem within",
    "redeem now",
]
PHISH = [
    "account will be blocked",
    "account has been",
    "will be suspended",
    "will be deactivated",
    "temporarily disabled",
    "verify your account",
    "update your info",
    "update your details",
    "confirm your identity",
    "confirm your account",
    "click the link",
    "click this link",
    "i-verify",
    "i-update ang iyong",
    "kailangan mong i-update",
    "avoid deactivation",
    "verify now",
    "verify here",
    "kyc",
    "reactivate",
    "verify the recipient",
    "verify the identity",
    "unable to deliver",
    "cannot be re-delivered",
    "incorrect address",
    "wrong address",
    "needs to be verified",
    "needs to be updated",
    # Account-security and failed-delivery pretexts. Round 4 showed these
    # reaching the Ham default once the impersonation rule was narrowed --
    # they carry no bait wording, so they need to be recognised positively
    # rather than by the absence of marketing language.
    "password has been changed",
    "password was changed",
    "your password has been",
    "has been changed successfully",
    "unsuccessfully delivered",
    "was not delivered",
    "delivery failed",
    "failed delivery",
    "undelivered parcel",
    "reschedule your delivery",
    # NB: "if you did not request this" is deliberately NOT here. It reads like
    # a phishing hook but is standard boilerplate on genuine OTP and security
    # notices ("...OTP: 167267. If you DID NOT request this, ignore this
    # message"), and adding it flipped real OTP deliveries to Scam.
]
JOB_SCAM = [
    "earn money from home",
    "part-time job",
    "part time job",
    "daily income",
    "online job",
    "work from home",
    "hiring",
    "no experience needed",
    "earn up to",
    "extra income",
    "easy income",
    "per day",
    "no need to go out work",
    # Tagalog/Taglish work-from-home bait. JOB_SCAM was English-only, so the
    # Filipino-language version of the same scam ("KUMITA NG MALAKI HABANG
    # NASA BAHAY LANG... CLICK LINK") had no rule to catch it -- the same
    # coverage gap that PROMO_TL fixed for Spam.
    "kumita ng malaki",
    "kumita habang",
    "nasa bahay lang",
    "sa bahay lang",
    "walang puhunan",
    "libreng trabaho",
    "trabaho sa bahay",
    "kikita ka",
    "dagdag kita",
    "raket sa bahay",
    # "Be an appointment setter, click our Messenger link" job blasts. Round 7
    # backlog review: these already trip suspicious_link() (m.me isn't an
    # official domain), but needed susp+JOB_SCAM and this vocabulary wasn't
    # here, so they fell through to the Ham default anyway.
    "earn while at home",
    "appointment setter",
    "homebased",
    "home-based",
    "copy-paste system",
    "be an onliner",
]

# Unsolicited "you already qualify" credit offers. Legitimate lenders do not
# pre-grant money to strangers by SMS; paired with evasion capitalisation or a
# suspicious link this is the classic PH loan-scam blast.
LOAN_BAIT = [
    "you are qualified",
    "you are granted",
    "granted credit",
    "no collateral",
    "no hidden charges",
    "pre-approved",
    "preapproved",
    "cash loan",
    "cash loans",
    "personal loan",
    "unsecured",
    "no guarantee",
    "no meetup",
    "no meet up",
    "waiting for you to apply",
    "complete your profile",
    "apply and get cash",
    "qualified to avail",
]

# Ham anchors (strong, positive signals).
OTP_RE = re.compile(
    r"\b(otp|one[- ]time (pin|password|code)|verification code|auth\w* code|"
    r"authentication code)\b|do not share",
    re.I,
)
GOV_SENDERS = {"ndrrmc", "ntc", "pagasa", "phivolcs", "namria", "dilg", "doh"}

# Telco/bank informational notices -> Ham (when no suspicious link).
TELCO_INFO = [
    "bill summary",
    "estatement",
    "e-statement",
    "gigalife",
    "myaccount",
    "welcome to cmhk",
    "details of your charges",
    "your bill is ready",
    # Regulator-mandated service notices (the 2019 NTC 8-digit landline
    # migration, service-interruption and grace-period advisories). These are
    # obligations being communicated, not offers being made.
    "in compliance with the directive",
    "in compliance with the bayanihan",
    "scheduled maintenance",
    "service interruption",
    "grace period",
    "we are experiencing some issues",
    "will become eight digits",
    "add 8 before",
    "system upgrade",
    "temporary service",
]

# Official public advisories and institutional announcements. Explicit
# advisory framing only -- deliberately NOT bare words like "advisory" or
# "reminder", which smishing uses freely. Matched only after every scam rule
# has already declined the message (see label_raw), so a survivor with this
# framing is a genuine public notice: DOH health bulletins, mall safety
# advisories, university announcements to parents.
ADVISORY = [
    "public service advisory",
    "covid19 advisory",
    "covid-19 advisory",
    "health advisory",
    "public advisory",
    "service advisory",
    "we would like to inform you",
    "we'd like to inform",
    "we wish to inform",
    "please be informed that",
    "advisory:",
    "announcement:",
    # Service-availability notices ("checking and redemption of Globe Rewards
    # points will be unavailable"). Informing about downtime, not selling.
    "will be unavailable",
    "temporarily unavailable",
    "will be down",
    "para sa covid-19 information",
    "alamin ang inyong karapatan",
    # Statutory-compliance notices. A company announcing an obligation it is
    # subject to (the Bayanihan Act payment grace period, NTC directives) is
    # informing, not selling -- but these carry a link to the full terms, so
    # they need the advisory path rather than the link-clean TELCO_INFO path.
    "in compliance with the",
    "as mandated by",
    "pursuant to",
]

# Transaction receipts / delivery notices -- confirming something that already
# happened. Not a pitch, even when a loyalty raffle is mentioned at the end.
RECEIPT = [
    "thank you for paying",
    "thank you for your payment",
    "payment received",
    "we received your payment",
    "your payment of",
    "successfully paid",
    "is delivering your order",
    "out for delivery",
    "has been delivered",
    "your parcel",
    "to track a parcel",
    "salamat sa iyong bayad",
]

# Broadened TLD list. The previous 21-entry list silently ignored every link on
# .tv/.life/.tw/.bid/.golf/... -- which is exactly where the scam traffic lives.
_TLD = (
    r"com|net|org|info|biz|co|io|me|ph|online|site|website|space|store|shop|"
    r"club|link|live|life|world|today|top|vip|xyz|icu|bid|win|fun|fyi|one|now|"
    r"city|zone|plus|pro|app|dev|gg|tv|fm|cc|ws|st|ee|eu|de|fr|nl|uk|ru|su|pl|"
    r"it|es|ca|mx|br|ar|cl|tw|hk|cn|jp|kr|sg|my|id|th|vn|in|la|ly|to|tk|ml|ga|"
    r"cf|gq|pw|sbs|cfd|rest|bar|beauty|quest|monster|autos|homes|golf|auction|"
    r"support|help|fan|show|buzz|sale|qpon|mom|lol|bond|cyou|cam|uno|email|"
    r"click|page|host|press|art|blog|digital|agency|solutions|"
    # Added after scanning every domain-like token in the corpus -- the list
    # above still missed these, and they carry real traffic (.ht/.lc/.cx were
    # letting Tagalog gambling blasts through as "no link present").
    r"cx|ht|gl|lc|ty|fo|sh|ch|ink|yt|ac|ms|ai|im|za|us|si|be|nu|gs|cd|ci|"
    r"vegas|guru|ltd|school|center|market|loan|vin|is"
)
URL_RE = re.compile(r"(?:https?://|www\.|hxxp)\S+|\b[a-z0-9-]+\.(?:" + _TLD + r")\b(?:/\S*)?", re.I)
DOMAIN_RE = re.compile(r"(?:https?://)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)", re.I)

# Punycode or a domain-looking token carrying non-Latin characters:
# '666рф.рф', '108.भारत', 'xn--80ak6aa92e.com'. Never legitimate in PH SMS.
# The negative lookahead on the final segment excludes peso amounts with a
# decimal point ('...for P16054.5.', '[TikTok] your bill of P554.54 is due') --
# a real domain's part after the dot never starts with a digit, but a currency
# amount's does, and the un-guarded version was flagging OTP/receipt messages
# as scams over nothing but their own peso sign. Found 2026-07-30 while
# reviewing the newest raw batch.
IDN_RE = re.compile(r"xn--[a-z0-9-]+|[^\s/]*[^\x00-\x7F][^\s/]*\.(?!\d)[^\s/]{2,}")


# --------------------------------------------------------------------------- #
def _matcher(*term_lists):
    """Word-boundary matcher so 'bet' doesn't fire inside 'alphabet'.

    Boundaries are only added on edges that are alphanumeric, so phrase terms
    like '% off' still match after a digit ('50% off').
    """
    # Apostrophes count as boundary chars so "you won" doesn't fire on "you won't".
    terms = [t for lst in term_lists for t in lst]
    parts = []
    for t in sorted(terms, key=len, reverse=True):
        pat = re.escape(t)
        if t[:1].isalnum():
            pat = r"(?<![a-z0-9'’])" + pat
        if t[-1:].isalnum():
            pat = pat + r"(?![a-z0-9'’])"
        parts.append(pat)
    return re.compile("|".join(parts), re.I)


_PSA = _matcher(PSA)
_GAMBLING = _matcher(GAMBLING_HARD)
_GAMBLING_SOFT = _matcher(GAMBLING_SOFT)
_WIN_SCAM = _matcher(WIN_SCAM)
_PHISH = _matcher(PHISH)
_JOB = _matcher(JOB_SCAM)
_JOB_AD = _matcher(JOB_AD)
_PROMO = _matcher(PROMO_TERMS, PROMO_TL)
_PROMO_ANY = _matcher(PROMO_TERMS, PROMO_TL, PROMO_BAIT)
_TELCO_INFO = _matcher(TELCO_INFO)
_RECEIPT = _matcher(RECEIPT)
_ADVISORY = _matcher(ADVISORY)
_LOAN_BAIT = _matcher(LOAN_BAIT)
_BAIT_PHISH_JOB = _matcher(WIN_SCAM, PROMO_BAIT, PHISH, JOB_SCAM, LOAN_BAIT)
_BRAND_RE = {b: _matcher([b]) for b in BRAND_DOMAINS}

# --- Filter-evasion capitalisation ----------------------------------------- #
_INTERNAL_CAPS = re.compile(r"\b[a-z]+[A-Z][a-zA-Z]*\b")
_ALPHA_WORD = re.compile(r"\b[A-Za-z]{3,}\b")


def evasion_caps(text: str) -> bool:
    """'CreDit', 'gRanTed', 'ComPlete' -- capitals inside a word.

    Legitimate senders never do this; it exists purely to break keyword filters.
    Three or more such words is deliberate.
    """
    return len(_INTERNAL_CAPS.findall(text or "")) >= 3


def title_heavy(text: str) -> bool:
    """'This Is MS.NICOLE Of SECURITY BANK, I Just Want To Inform You' --
    Title-Casing Almost Every Word is a mass-blast / evasion signature."""
    words = _ALPHA_WORD.findall(text or "")
    if len(words) < 12:
        return False
    titled = sum(1 for w in words if w[0].isupper() and w[1:].islower())
    return titled / len(words) >= 0.6


def has_any(text: str, deleeted: str, matcher) -> bool:
    """Match the raw text OR its de-obfuscated form."""
    return matcher.search(text) is not None or matcher.search(deleeted) is not None


def _domains(text: str):
    return {d.lower() for d in DOMAIN_RE.findall(text or "")}


def suspicious_link(text: str) -> bool:
    """A URL whose domain is not on the official whitelist (or a de-fanged link)."""
    low = (text or "").lower()
    if "hxxp" in low:
        return True
    if IDN_RE.search(text or ""):
        return True
    for d in _domains(text):
        # Skip pure digit.digit amounts ("20.00"). NOT digit-led domains like
        # "9y15.com" / "1q2w3e7.ca" -- gambling blasts pick those precisely to
        # dodge keyword filters, so treating them as "not a link" is the bug.
        if re.match(r"^\d+\.\d+$", d):
            continue
        if d in {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com"}:
            continue
        # Registrar-restricted institutional TLDs (.gov.ph, .edu.ph) -- see
        # TRUSTED_TLD_SUFFIXES. These require documentary proof to register.
        if any(d == suf or d.endswith("." + suf) for suf in TRUSTED_TLD_SUFFIXES):
            continue
        if not any(d == o or d.endswith("." + o) for o in OFFICIAL_DOMAINS):
            # only count it if it really looks like a web link, not "e.g"
            if re.search(r"\.(?:" + _TLD + r")(\b|/)", d):
                return True
    return False


def impersonation_is_deceptive(text: str, deleeted: str, brand: str, t: str, td: str) -> bool:
    """Does a brand-name + off-domain-link pairing actually show deception?

    ``brand_impersonation`` alone is too blunt: it fires whenever a message
    names a brand and no link sits on that brand's own domain. Real Philippine
    brands break that constantly -- Shopee and Globe blast campaigns through
    bit.ly, DITO links to its lender partner juanhand.com, UnionBank routes a
    card offer via Moneymax. Human review round 4 found ~37% of this rule's
    output was legitimate marketing (Bug History §10).

    Deception requires at least one of:

    1. the brand name sitting *inside* the linked domain ('mayabank.tw',
       'gcash-verify.com') -- that is the impersonation itself;
    2. bait / phishing / prize-win / job-scam language;
    3. a link on a throwaway TLD no real brand campaigns on.

    A brand + a shortened or partner link + ordinary promo wording is
    advertising, and falls through to the Spam rules instead.
    """
    doms = _domains(text)
    if any(brand in d for d in doms):
        return True
    if has_any(t, td, _BAIT_PHISH_JOB):
        return True
    if any(d.rsplit(".", 1)[-1] in SCAMMY_TLDS for d in doms):
        return True
    # The exemption is for *advertising*, so it requires actual advertising
    # wording. Without this clause an account-security notice carrying no
    # promo language at all ("Lazada: Your PASSWORD has been CHANGED", "LBC:
    # your order was unsuccessfully delivered") would be waved through as
    # marketing -- those are textbook impersonation phishing.
    if not has_any(t, td, _PROMO_ANY):
        return True
    return False


def institutional_link(text: str) -> bool:
    """Message carries a link, and EVERY link on it is institutional.

    Requires *all* links to be trusted, not merely one: a scam that name-drops
    "doh.gov.ph" alongside its own payload domain must not launder itself into
    Ham on the strength of the decoy.
    """
    ds = [d for d in _domains(text) if not re.match(r"^\d+\.\d+$", d) and re.search(r"\.(?:" + _TLD + r")(\b|/)", d)]
    if not ds:
        return False
    return all(any(d == suf or d.endswith("." + suf) for suf in TRUSTED_TLD_SUFFIXES) for d in ds)


def brand_impersonation(text: str, deleeted: str) -> str:
    """Names a brand, carries a link, and no link is that brand's own domain.

    Returns the impersonated brand, or "" when clean. Deliberately still fires
    when the brand name appears only *inside* the fake domain ('mayabank.tw') --
    that is the impersonation, not a false positive.
    """
    if not URL_RE.search(text or ""):
        return ""
    doms = _domains(text)
    # A message linking to ANY verified-official domain is a legitimate sender
    # mentioning another brand, not an impersonator -- e.g. Globe advertising a
    # GCash prize via glbe.co. Without this guard those fire as "gcash" fakes.
    if any(d == o or d.endswith("." + o) for d in doms for o in OFFICIAL_DOMAINS):
        return ""
    for brand, official in BRAND_DOMAINS.items():
        if has_any(text, deleeted, _BRAND_RE[brand]):
            if not any(d == o or d.endswith("." + o) for d in doms for o in official):
                return brand
    return ""


def label_raw(sender: str, body: str):
    """Return (label, confidence, reason) for an unlabeled inbox message."""
    s = (sender or "").strip().lower()
    t = (body or "").lower()
    td = deleet(t)
    susp = suspicious_link(body)
    brand = s in BRAND_SENDERS

    # --- ANTI-SCAM ADVISORY (must beat every scam rule) -------------------- #
    # Telco/bank safety education. Excluded when the message is itself an OTP
    # delivery ("...your OTP is 440855. Never share your OTP") -- those are
    # ordinary transactional messages and must still face the scam rules below,
    # because "do not share" and "verification code" also appear in smishing.
    # The OTP carve-out targets real OTP *deliveries* ("your OTP is 440855.
    # Never share your OTP"), which must still face the scam rules. It keyed on
    # the word "OTP" alone, which also silenced genuine warnings that merely
    # mention OTPs ("...nanghihingi ng personal info, password, o OTP? Scam
    # yan!"). A delivery carries an actual code, so require one.
    otp_delivery = bool(OTP_RE.search(body or "") and re.search(r"\b\d{4,8}\b", body or ""))
    if has_any(t, td, _PSA) and not susp and not otp_delivery:
        return "Ham", "high", "anti-scam-advisory"

    # --- SCAM (deception / fraud) ------------------------------------------ #
    # Unambiguous gambling operators/mechanics fire on their own.
    if has_any(t, td, _GAMBLING):
        return "Scam", "high", "gambling-bait"
    # Non-Latin / punycode domain -- never legitimate here.
    if IDN_RE.search(body or ""):
        return "Scam", "high", "non-latin-domain"
    # Credit-card ID-harvesting via email. Round 7 backlog review found
    # RCBC/EastWest/Citibank "FREE FOR LIFE ANNUAL FEE" blasts that ask you to
    # email 2 government IDs + a photo of your card to a gmail.com address.
    # No link (gmail.com is explicitly exempt in suspicious_link -- correctly,
    # most legit replies go there too), and the message is ALL-CAPS rather
    # than the internal-caps pattern evasion_caps() looks for, so nothing else
    # in this cascade catches it. This pairing is specific enough that no
    # legitimate offer uses it.
    if "government id" in td and ("frontface of" in td or "front face of" in td):
        return "Scam", "high", "id-harvest-via-email"
    # Invokes a brand but links somewhere that isn't the brand's own domain.
    imp = brand_impersonation(body or "", deleet(body or ""))
    if imp and impersonation_is_deceptive(body or "", deleet(body or ""), imp, t, td):
        return "Scam", "high", "brand-impersonation:" + imp
    # Filter-evasion capitalisation plus a money pitch. Catches the bank-officer
    # impersonations and pre-granted-credit blasts that carry no link at all
    # ("This Is MS.NICOLE Of SECURITY BANK... You Are Qualified To Avail").
    if (evasion_caps(body) or title_heavy(body)) and has_any(t, td, _LOAN_BAIT):
        return "Scam", "high", "evasion-caps+loan-bait"
    if evasion_caps(body) and has_any(t, td, _BAIT_PHISH_JOB):
        return "Scam", "high", "evasion-caps+bait"
    # A suspicious (non-official) link plus any bait/phish/job pitch.
    if susp and has_any(t, td, _BAIT_PHISH_JOB):
        return "Scam", "high", "susp-link+bait"
    # Account-phishing that asks you to act on a code/OTP (classic smishing).
    if has_any(t, td, _PHISH) and ("otp" in td or "code" in td):
        return "Scam", "high", "phishing+action"
    # Soft gambling vocabulary: needs corroboration (a link, or a second hit).
    soft = len(set(m.lower() for m in _GAMBLING_SOFT.findall(t)) | set(m.lower() for m in _GAMBLING_SOFT.findall(td)))
    if soft >= 2 or (soft and susp):
        return "Scam", "high", "gambling-soft"
    # Lottery/prize-win phrasing that legit promos don't use -> Scam even
    # without a link (from a known brand it's still suspect enough to flag).
    if has_any(t, td, _WIN_SCAM):
        return "Scam", "medium", "prize-win-bait"
    # NOTE: bare phishing/urgency language with NO link and NO code is
    # deliberately NOT flagged Scam -- legit SIM-registration reminders
    # ("register now to avoid deactivation") share that wording. Real phishing
    # is caught above via a suspicious link or a code/OTP hook.

    # --- HAM anchors (before Spam so OTPs/gov alerts win) ------------------- #
    if OTP_RE.search(body or "") and not susp:
        return "Ham", "high", "otp/verification"
    if s in GOV_SENDERS:
        return "Ham", "high", "gov-alert"
    if has_any(t, td, _TELCO_INFO) and not susp:
        return "Ham", "high", "telco-info"
    # Official notices from institutions whose every link sits on a
    # registrar-restricted domain (.gov.ph / .edu.ph): DOH health advisories,
    # BSP consumer-rights notices, university announcements. These read as
    # promotional ("visit our website", "bisitahin ang...", "join us") and were
    # being labeled Spam, but a public-health advisory is not marketing.
    # Human review round 3 -- 21 of 23 disagreements were this exact shape.
    if institutional_link(body or "") and not susp:
        return "Ham", "high", "institutional-notice"
    # Transaction receipts. "Thank you for paying P1150.00..." is confirming
    # something the user already did -- transactional, not a pitch, even when
    # the tail end mentions a loyalty raffle.
    # Receipts keep their Ham verdict even when the message carries an
    # unrecognised link -- couriers and payment centres routinely append a
    # tracking or loyalty-raffle URL, and "thank you for paying <amount>" is
    # specific enough to stand on its own. Protected the same way as
    # public-advisory below: every scam rule already declined this message,
    # plus the residual bait check.
    if has_any(t, td, _RECEIPT) and not has_any(t, td, _BAIT_PHISH_JOB):
        return "Ham", "high", "transaction-receipt"
    # Explicitly-framed public advisories (DOH health bulletins, mall safety
    # notices, school announcements). Unlike the rules above this does not
    # require a clean link -- official bodies legitimately point at their own
    # Facebook page, and facebook.com cannot be whitelisted outright because
    # scams use it too. The protection is positional: every gambling, phishing,
    # impersonation, bait and job-scam rule already declined this message, and
    # a residual bait check runs below.
    if has_any(t, td, _ADVISORY) and not has_any(t, td, _BAIT_PHISH_JOB):
        return "Ham", "high", "public-advisory"

    # --- SPAM (honest promotion) ------------------------------------------- #
    if has_any(t, td, _JOB_AD) and not susp:
        return "Spam", "high", "job-ad"
    promo = has_any(t, td, _PROMO_ANY)
    if (brand and promo) or (promo and not susp):
        return "Spam", "high" if (brand and promo) else "medium", "promo"
    if brand and URL_RE.search(body or "") and not susp:
        return "Spam", "medium", "brand-link"
    # Promotional language + a link that isn't on the official whitelist, from a
    # sender we don't recognize as a brand ("LOT FOR SALE... visit our page
    # facebook.com/..."). Every scam rule above already had first crack at this
    # message and found no bait/phish/job/gambling signal, so "small business
    # advertising on their own site" is a far more likely explanation than "well
    # -disguised scam". Previously this fell all the way through to the Ham
    # default, which is why real-estate/retail ads with non-whitelisted links
    # were training the model to call honest Spam "Ham".
    if promo:
        return "Spam", "low", "promo-unverified-link"

    # --- HAM (default: personal / transactional / service) ----------------- #
    personal = bool(re.match(r"^(snd-|\+?63|\+?09|09)", s)) or s == ""
    short_convo = len(body or "") < 120 and not URL_RE.search(body or "")
    if personal and short_convo:
        return "Ham", "high", "personal-convo"
    if not URL_RE.search(body or "") and not brand:
        return "Ham", "medium", "no-link-default"
    # Has a link/brand but hit no promo/scam rule -> unsure, needs a human.
    return "Ham", "low", "unclassified-review"


# --------------------------------------------------------------------------- #
# Language identification (English / Tagalog / Taglish).
#
# Only the NTC file ships a language column, and it merges Tagalog and Taglish
# into one value -- so all three are derived uniformly here instead. Method:
# count DISTINCT high-precision function words from each language; a message
# carrying markers from both is code-switched (Taglish).
# --------------------------------------------------------------------------- #

TL_MARKERS = {
    "ang",
    "ng",
    "mga",
    "sa",
    "ay",
    "ako",
    "ikaw",
    "siya",
    "kami",
    "kayo",
    "sila",
    "namin",
    "natin",
    "ninyo",
    "nila",
    "niya",
    "ito",
    "iyan",
    "iyon",
    "dito",
    "diyan",
    "doon",
    "kung",
    "dahil",
    "hindi",
    "wala",
    "meron",
    "opo",
    "yung",
    "kasi",
    "lamang",
    "lang",
    "naman",
    "nga",
    "pala",
    "sana",
    "dapat",
    "pwede",
    "puwede",
    "gusto",
    "ayaw",
    "upang",
    "nang",
    "mula",
    "hanggang",
    "tungkol",
    "maging",
    "mo",
    "ko",
    "niyo",
    "po",
    "huwag",
    "wag",
    "iyong",
    "kanilang",
    "aming",
    "ating",
    "ngayon",
    "pera",
    "libre",
    "libreng",
    "halika",
    "sumali",
    "kunin",
    "bigyan",
    "makatanggap",
    "magkaroon",
    "kumita",
    "salamat",
    "kumusta",
    "muna",
    "pagkakataon",
    "paraan",
    "tulong",
    "bawat",
    "lahat",
    "isang",
    "dalawang",
    "walang",
    "para",
    "ni",
    "si",
    "nasa",
    "may",
    "maswerte",
    "masaya",
    "araw-araw",
    "bilang",
    "ginawa",
    "gagawin",
}

EN_MARKERS = {
    "the",
    "and",
    "is",
    "are",
    "was",
    "were",
    "you",
    "your",
    "yours",
    "to",
    "for",
    "of",
    "with",
    "this",
    "that",
    "these",
    "those",
    "have",
    "has",
    "had",
    "will",
    "would",
    "can",
    "could",
    "should",
    "now",
    "get",
    "free",
    "click",
    "please",
    "account",
    "verify",
    "from",
    "not",
    "but",
    "all",
    "any",
    "our",
    "their",
    "his",
    "her",
    "its",
    "been",
    "being",
    "more",
    "than",
    "then",
    "when",
    "where",
    "what",
    "who",
    "how",
    "why",
    "here",
    "there",
    "just",
    "only",
    "also",
    "very",
    "new",
    "today",
    "day",
    "time",
    "we",
    "they",
    "it",
    "he",
    "she",
    "on",
    "in",
    "at",
    "by",
    "as",
    "if",
    "or",
    "so",
    "up",
    "out",
    "off",
    "do",
    "does",
    "did",
    "be",
    "am",
    "about",
    "into",
    "over",
    "after",
    "before",
    "again",
    "still",
    "may",
}

_WORD_RE = re.compile(r"[a-zA-ZÀ-ɏ']+")


def detect_language(text: str) -> str:
    """Return 'english', 'tagalog', 'taglish' or 'undetermined'."""
    words = [w.lower() for w in _WORD_RE.findall(text or "")]
    if not words:
        return "undetermined"
    tl = len({w for w in words if w in TL_MARKERS})
    en = len({w for w in words if w in EN_MARKERS})
    # Both languages clearly present -> code-switched.
    if tl >= 2 and en >= 2:
        return "taglish"
    if tl >= 2 and en <= 1:
        return "tagalog"
    if en >= 2 and tl <= 1:
        return "english"
    # Weak evidence: fall back to whichever side leads.
    if tl > en:
        return "tagalog"
    if en > tl:
        return "english"
    if tl == en and tl > 0:
        return "taglish"
    return "undetermined"


# --------------------------------------------------------------------------- #
# Source-label handling.
#
# Two of the three Kaggle corpora were included *because* they carry legitimate
# and marketing messages (manuscript p177), so their blanket ``scam`` stamp is
# not evidence. The NTC file is citizen reports of *suspected* scams -- mostly
# right, but people report legitimate marketing too. In both cases the rules may
# override the stamp ONLY when they found positive evidence; otherwise the stamp
# stands at low confidence and goes to review.
# --------------------------------------------------------------------------- #

# Corpora whose blanket "scam" stamp is unreliable.
UNVERIFIED_CORPORA = {"SPAM_SMS", "tagalog-sms"}

# Rule verdicts strong enough to overturn a source "scam" stamp.
POSITIVE_HAM = {"anti-scam-advisory", "otp/verification", "gov-alert", "telco-info"}
POSITIVE_SPAM = {"promo", "brand-link", "job-ad"}


def reconcile(source_label: str, rule, trusted: bool):
    """Combine a source stamp with a rule verdict.

    ``trusted`` marks corpora that really are scam-only (BwandoWando's
    "Philippine Spam/Scam SMS"). Even there a PSA or official-domain notice
    still wins -- those are unambiguous.
    """
    label, conf, reason = rule
    # The rules independently found deception -> agrees with the stamp.
    if label == "Scam":
        return "Scam", "high", reason
    # Positive evidence that this is NOT a scam.
    if label == "Ham" and reason in POSITIVE_HAM:
        return "Ham", "high", "override:" + reason
    if not trusted and label == "Spam" and reason in POSITIVE_SPAM:
        return "Spam", "high", "override:" + reason
    if trusted and reason in ("anti-scam-advisory", "telco-info"):
        return "Ham", "high", "override:" + reason
    # No positive evidence -> keep the source stamp but flag it for a human.
    return source_label, "low", "source-label-unverified"


# --------------------------------------------------------------------------- #
def load_prelabeled():
    """Rows carrying a source label."""
    out = []
    kag = os.path.join(SRC, "Kaggle", "SCAM_MESSAGES_COMBINED.csv")
    with open(kag, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            body = (row.get("text") or "").strip()
            if not body:
                continue
            corpus = (row.get("source") or "").strip()
            sender = (row.get("sender") or "").strip()
            rule = label_raw(sender, body)
            label, conf, reason = reconcile("Scam", rule, trusted=corpus not in UNVERIFIED_CORPORA)
            out.append((body, label, "kaggle:" + corpus, conf, reason, sender, (row.get("date") or "").strip(), "Scam"))
    ntc = os.path.join(SRC, "NTC", "FOI-TEST-DATASET.csv")
    with open(ntc, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            body = (row.get("text") or "").strip()
            if not body:
                continue
            rule = label_raw("FOI-NTC", body)
            # Citizen reports: suspected, not verified -> not "trusted".
            label, conf, reason = reconcile("Scam", rule, trusted=False)
            out.append((body, label, "ntc", conf, reason, "FOI-NTC", "", "Scam"))
    return out


def load_raw():
    """Real inbox exports. No source label -- rules decide."""
    seen = {}
    for path in sorted(glob.glob(os.path.join(SRC, "Raw", "*.csv"))):
        with open(path, encoding="utf-8-sig", newline="") as f:
            text = f.read()
        # Some phone-export batches pad a body with trailing NUL bytes (seen in
        # the 2026-07-31 export, inside an otherwise-intact Yahoo OTP message).
        # csv.reader raises unconditionally on an embedded NUL, so strip them
        # rather than let one export tool's quirk crash the whole build.
        if "\x00" in text:
            text = text.replace("\x00", "")
        for row in csv.DictReader(io.StringIO(text)):
                body = (row.get("body") or "").strip()
                sender = (row.get("address") or row.get("sender_id") or "").strip()
                if not body:
                    continue
                # Phone exports use date_iso/date_epoch_ms; the Kaggle files use
                # "date". HDBSCAN campaign clustering needs these (manuscript
                # p177), so take whichever the export actually provides.
                stamp = (
                    row.get("date_iso") or row.get("date") or row.get("timestamp") or row.get("date_epoch_ms") or ""
                ).strip()
                seen[(sender.lower(), body)] = (sender, body, stamp)
    out = []
    for sender, body, stamp in seen.values():
        label, conf, reason = label_raw(sender, body)
        out.append((body, label, "raw-inbox", conf, reason, sender, stamp, ""))
    return out


HEADER = ["text", "label", "source", "confidence", "reason", "sender", "timestamp", "source_label", "language"]

# scripts/create_holdout_set.py physically moved 20% of bantai_labeled.csv out
# to datasets/holdout/holdout.csv (WBS 6.4.6) so it would be permanently
# invisible to every future training/retraining run -- but this script
# rebuilds bantai_labeled.csv from the ORIGINAL raw sources, which know
# nothing about that carve-out, so a naive rebuild silently puts every
# held-out row straight back into the training pool. Excluded here by the
# same masked-text key create_holdout_set.py used to select them, so a
# rebuild after adding new raw data can never quietly re-contaminate the
# holdout set.
HOLDOUT_CSV = os.path.join(DATASETS, "holdout", "holdout.csv")


def _holdout_masked_texts() -> set:
    if not os.path.isfile(HOLDOUT_CSV):
        return set()
    from preprocessing import preprocess

    with open(HOLDOUT_CSV, encoding="utf-8") as f:
        return {preprocess(str(row["text"])) for row in csv.DictReader(f)}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(AUDIT, exist_ok=True)
    rows = load_prelabeled() + load_raw()

    # Audit keeps every occurrence (campaign clustering needs the full picture,
    # including the same text arriving from several senders at several times).
    audit_rows = [r + (detect_language(r[0]),) for r in rows]

    # De-dupe on text for TRAINING only (duplicates skew the loss).
    by_text = {}
    for r in audit_rows:
        key = r[0].strip()
        prev = by_text.get(key)
        if prev is None or (prev[3] != "high" and r[3] == "high"):
            by_text[key] = r
    final = list(by_text.values())

    holdout_masked = _holdout_masked_texts()
    if holdout_masked:
        from preprocessing import preprocess

        before = len(final)
        final = [r for r in final if preprocess(str(r[0])) not in holdout_masked]
        excluded = before - len(final)
        if excluded:
            print(f"Excluded {excluded} row(s) already carved out to {HOLDOUT_CSV} (WBS 6.4.6) -- kept out of training.")

    # Training CSV. Extra columns are harmless -- the loader selects by name --
    # and the timestamp is required for HDBSCAN campaign clustering (p177).
    train_path = os.path.join(OUT, "bantai_labeled.csv")
    with open(train_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["text", "label", "language", "timestamp", "source"])
        for body, label, src, conf, reason, sender, stamp, orig, lang in final:
            w.writerow([body, label, lang, stamp, src])

    # Every rebuild starts from the rules alone, which silently discards any
    # human correction recorded in the review sheets unless this runs
    # afterwards -- previously a manual second command (apply_review_corrections.py)
    # that was easy to forget (found missing 2026-08-26: 163 already-confirmed
    # corrections sat absent from the training data after a rebuild). Now part
    # of the rebuild itself so there is no second step to skip.
    from apply_review_corrections import apply_corrections

    correction_stats = apply_corrections(train_path, AUDIT)
    corrected_labels = {}
    with open(train_path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            corrected_labels[row["text"]] = row["label"]
    final = [
        (body, corrected_labels.get(body, label), src, conf, reason, sender, stamp, orig, lang)
        for (body, label, src, conf, reason, sender, stamp, orig, lang) in final
    ]

    for path, data in (
        (os.path.join(AUDIT, "bantai_labeled_full.csv"), audit_rows),
        (os.path.join(AUDIT, "needs_review.csv"), [r for r in final if r[3] == "low"]),
        (os.path.join(AUDIT, "label_changes.csv"), [r for r in audit_rows if r[7] and r[1] != r[7]]),
    ):
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(HEADER)
            w.writerows(data)

    review = [r for r in final if r[3] == "low"]
    changed = [r for r in audit_rows if r[7] and r[1] != r[7]]

    # Report.
    labels = Counter(r[1] for r in final)
    conf = Counter(r[3] for r in final)
    langs = Counter(r[8] for r in final)
    total = len(final)
    LANGS = ("english", "tagalog", "taglish", "undetermined")
    print("=" * 72)
    print("Consolidated dataset: %d unique messages (%d rows before de-dupe)" % (total, len(audit_rows)))
    print("-" * 72)
    print("By label:")
    for k in ("Ham", "Spam", "Scam"):
        print("  %-5s %6d  (%.1f%%)" % (k, labels.get(k, 0), 100 * labels.get(k, 0) / total))
    print("By language:")
    for k in LANGS:
        print("  %-13s %6d  (%.1f%%)" % (k, langs.get(k, 0), 100 * langs.get(k, 0) / total))
    print("By confidence:")
    for k in ("high", "medium", "low"):
        print("  %-6s %6d  (%.1f%%)" % (k, conf.get(k, 0), 100 * conf.get(k, 0) / total))
    print("-" * 72)
    print("Label x language:")
    print(
        "  %-6s" % ""
        + "".join("%12s" % lang for lang in ("english", "tagalog", "taglish", "undet."))
        + "%12s" % "TOTAL"
    )
    for lab in ("Ham", "Spam", "Scam"):
        cells = [sum(1 for r in final if r[1] == lab and r[8] == lg) for lg in LANGS]
        print("  %-6s" % lab + "".join("%12d" % c for c in cells) + "%12d" % sum(cells))
    cells = [sum(1 for r in final if r[8] == lg) for lg in LANGS]
    print("  %-6s" % "TOTAL" + "".join("%12d" % c for c in cells) + "%12d" % sum(cells))
    print("-" * 72)
    print("By source x label:")
    srcs = sorted({r[2] for r in final})
    for s in srcs:
        c = Counter(r[1] for r in final if r[2] == s)
        print("  %-22s Ham %5d  Spam %5d  Scam %5d" % (s, c.get("Ham", 0), c.get("Spam", 0), c.get("Scam", 0)))
    print("-" * 72)
    print("Top reasons:")
    for k, v in Counter(r[4] for r in final).most_common(18):
        print("  %-28s %6d" % (k, v))
    print("-" * 72)
    print("training CSV  -> %s" % train_path)
    print("audit CSV     -> %s" % os.path.join(AUDIT, "bantai_labeled_full.csv"))
    print("needs review  -> %s  (%d rows)" % (os.path.join(AUDIT, "needs_review.csv"), len(review)))
    print("label changes -> %s  (%d rows)" % (os.path.join(AUDIT, "label_changes.csv"), len(changed)))
    print("=" * 72)


if __name__ == "__main__":
    main()
