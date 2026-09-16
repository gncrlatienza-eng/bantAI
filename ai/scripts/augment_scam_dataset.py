"""Targeted augmentation of the Scam class (adviser-approved 2026-09).

**Why this exists.** The 2026-09-16 error analysis of the frozen holdout found
the model's scam misses are not spread evenly: it misses 0.5% of gambling
bait (768 training rows) and 50% of fake job offers (15 training rows). Miss
rate tracks training support almost perfectly, so the fix is more examples of
the rare scam families -- not a threshold change (29 of the 38 missed scams
scored below 0.10, so no threshold could have caught them).

**Two constraints specific to this pipeline, both easy to get wrong:**

1. *Varying links, amounts, phone numbers or codes accomplishes nothing.*
   ``preprocessing.preprocess`` replaces them with ``<URL>``/``<AMOUNT>``/
   ``<PHONE>``/``<OTP>`` before the model sees anything, so a "variant" that
   only swaps the link is byte-identical after masking and gets dropped by
   the snapshot's de-duplication. Variation has to live in wording, sentence
   structure, language mix and brand names (brands are *not* masked).

2. *A variant of a holdout message is training on the test set.* Seeds are
   checked against the frozen holdout and excluded, and nothing generated here
   may ever enter the holdout. The holdout stays entirely real, or the
   headline number stops meaning anything.

**Provenance is mandatory, not decoration.** Every row carries ``origin``
(``variant`` or ``authored``), the ``seed_id`` it came from, and its
``category``, so the synthetic rows can be counted, excluded, and ablated
(train with and without) to show what the augmentation actually bought.

Output is written to ``datasets/augmented/`` for review. It is **not** merged
into ``datasets/labeled/bantai_labeled.csv`` by this script -- that stays a
deliberate human step.

Run:
    cd ai && .venv/Scripts/python.exe scripts/augment_scam_dataset.py --sample
        Generate a small batch to eyeball, write nothing.

    cd ai && .venv/Scripts/python.exe scripts/augment_scam_dataset.py
        Generate to target counts and write datasets/augmented/.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import random
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

sys.path.insert(0, ".")

from preprocessing import preprocess  # noqa: E402
from service.indicator_tags import tags_for_message  # noqa: E402

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

LABELED_CSV = "datasets/labeled/bantai_labeled.csv"
HOLDOUT_CSV = "datasets/holdout/holdout.csv"
OUT_DIR = "datasets/augmented"

#: How many rows each weak category should end up with in the training pool,
#: counting the real ones it already has. Set from the 2026-09-16 analysis:
#: these four have both the highest miss rates and the thinnest support.
#: Gambling Bait (768 rows, 0.5% miss) is deliberately absent -- it needs
#: nothing, and adding to it would deepen the imbalance that caused this.
TARGETS = {
    "Fake Job Offer": 150,
    "Unsolicited Credit Offer": 150,
    "Personal Info Request": 150,
    "Brand Impersonation": 400,
}

#: No more than this many variants from one real message. Ten variants of one
#: seed teaches the model that message, not the pattern behind it.
MAX_VARIANTS_PER_SEED = 3

#: Scam-labeled rows matching this are **not** used as seeds. Found 2026-09-16
#: by human review of a generated batch: real DLSL school notices and DITO
#: telco messages are sitting in the pool labeled Scam, so variants of them
#: were fabricating "scams" out of genuine institutional messages. Excluding
#: them here is a stopgap for the generator only -- the rows are still in the
#: training data, which is the larger problem, and
#: ``scripts/make_institutional_scam_review_sheet.py`` exists to get them
#: re-labeled through the normal correction workflow.
#:
#: Deliberately over-broad: it also skips genuine scams that impersonate these
#: brands, which costs a few seeds and risks nothing. Seeds are the one input
#: where a wrong row is copied three more times.
SUSPECT_SEED = re.compile(
    r"\b(dlsl|la ?salle|dito|globe|smart|tnt|pldt|student|enrol|tuition|campus|parent|promo|unli|subscribe)\b",
    re.I,
)

#: Ceiling on how much of the Scam class may be synthetic. Past this the model
#: is mostly learning our writing style rather than how scams actually read.
MAX_SYNTHETIC_SHARE = 0.30

# --- slot values ------------------------------------------------------------
# Real Philippine brands and agencies, because impersonation of *these* is what
# the model has to recognise; a generic "YourBank" teaches nothing transferable.
BANKS = ["BDO", "BPI", "Metrobank", "LandBank", "PNB", "Security Bank", "UnionBank", "RCBC"]
WALLETS = ["GCash", "Maya", "GrabPay", "ShopeePay", "Coins.ph"]
TELCOS = ["Globe", "Smart", "DITO", "TM", "TNT"]
COURIERS = ["LBC", "J&T Express", "Flash Express", "Ninja Van", "2GO", "SPX Express"]
SHOPS = ["Shopee", "Lazada", "TikTok Shop"]
AGENCIES = ["SSS", "PhilHealth", "Pag-IBIG", "BIR", "DOLE", "LTO"]
JOB_TITLES = ["online encoder", "data entry staff", "typist", "product reviewer", "virtual assistant", "ad liker"]

GREETINGS_EN = ["Hi", "Hello", "Good day", "Dear customer", "Attention"]
GREETINGS_TL = ["Magandang araw po", "Hi po", "Good day po", "Kumusta po"]
CTA_EN = ["Click here", "Tap the link", "Visit", "Open this link", "Confirm here"]
CTA_TL = ["I-click po ito", "Pindutin ang link", "Punta po dito", "I-confirm po dito"]
#: Deadline phrases split by what they can sensibly attach to. "bago
#: ma-deactivate" (before it is deactivated) reads fine on an account warning
#: and nonsensical on a loan offer, and one list for both produced exactly
#: that: "Emergency cash? P50,000 available bago ma-deactivate".
URGENCY_EN = ["within 24 hours", "before 5PM today", "immediately", "within the day", "today only"]
URGENCY_TL = ["ngayong araw din", "bago mag-alas singko", "agad-agad", "ngayon lang po"]
URGENCY_ACCOUNT = [
    "before your account is closed",
    "before permanent suspension",
    "bago ma-deactivate",
    "bago tuluyang ma-lock",
]

LINK = "http://{host}"
#: Hosts are bound to the category they appear in. The model never sees them
#: -- masking turns every link into ``<URL>`` -- but a job offer linking to
#: "parcel-update.online" reads as obviously machine-made to anyone reviewing
#: the dataset by hand, and this data has to survive human review.
HOSTS: Dict[str, List[str]] = {
    "Fake Job Offer": ["hiring-ph.work", "apply-now.site", "jobs-ph.online", "wfh-careers.top"],
    "Unsolicited Credit Offer": ["loan-approved.site", "cash-release.online", "quickloan-ph.top"],
    "Personal Info Request": ["verify-records.site", "account-update.online", "ph-verify.help"],
    "Brand Impersonation": [
        "gcash-verify.help",
        "bdo-secure.info",
        "account-restore.top",
        "parcel-update.online",
        "rewards-claim.site",
    ],
}

# --- authored templates -----------------------------------------------------
# Patterns drawn from how these families actually read in Philippine SMS:
# a hook, a plausible sender, a deadline, and an action. Slots are filled from
# the lists above so a template yields many surface forms.
#: ⚠️ Language mix is not a style preference here, it is a correctness
#: constraint. Measured on the 2026-09-16 pool: "po" appears in 7.7% of *Ham*
#: messages and 0.7% of real Scam — it is a marker of ordinary Filipino
#: politeness, not of fraud. A first pass of this generator wrote "po" into
#: 53% of its rows; merging that would have taught the model "po -> Scam" and
#: produced false alarms on exactly the polite messages real users send.
#: Templates are therefore tagged by language and drawn to match the real
#: Scam rate, measured from the pool at run time rather than hardcoded.
#:
#: If that measured rate looks too low to be realistic (Filipino smishing in
#: the wild surely uses more Taglish than 0.7%), the honest fix is collecting
#: more real Taglish scams -- not manufacturing the correlation here.
TEMPLATES_TL: Dict[str, List[str]] = {
    "Fake Job Offer": [
        "URGENT HIRING po! {job} needed, P{pay} daily, work from home lang. Walang initial bayad. {cta_tl}: {link}",
        "Part-time job po available: {job}. P{pay} kada araw, flexible ang oras, pwede student. Message po sa {link}",
    ],
    "Unsolicited Credit Offer": [
        "Ma'am/Sir, qualified po kayo sa P{amount} loan. Walang collateral, 10 minutes release sa {wallet}. Apply: {link}",
        "Cash loan po hanggang P{amount}, approved agad kahit walang payslip. {cta_tl} {urgency}: {link}",
    ],
    "Personal Info Request": [
        "Paki-confirm po ang inyong buong pangalan, birthday at address para ma-update ang {agency} records ninyo. Salamat po.",
        "{agency} po ito. Kailangan po ng inyong pangalan at account details para sa verification ng claim ninyo.",
    ],
    "Brand Impersonation": [
        "{brand} po ito. Na-lock ang account ninyo dahil sa maraming failed login. {cta_tl} para ma-restore: {link}",
        "{courier} po: hindi po namin ma-deliver ang parcel ninyo. Paki-update ang address {urgency}: {link}",
        "{bank} po ito. May naka-hold na transfer sa account ninyo. {cta_tl} para ma-release {urgency}: {link}",
    ],
}

TEMPLATES: Dict[str, List[str]] = {
    "Fake Job Offer": [
        "{greet}! We saw your resume online. We are hiring {a_job}, P{pay}/day, home-based, no experience needed. Reply YES or {cta}: {link}",
        "{greet}, your application as {a_job} was pre-approved. Start today, salary P{pay}/day released daily. Register: {link}",
        "{greet}! Online job opening: {job}. Daily payout P{pay} via {wallet}. Limited slots, apply {urgency}: {link}",
        "Congrats! You passed the initial screening as {a_job}. Complete your registration {urgency} to secure the slot: {link}",
    ],
    "Unsolicited Credit Offer": [
        "{greet}! You are pre-approved for a P{amount} cash loan, 0% interest for 30 days. No collateral. Claim {urgency}: {link}",
        "{bank} Loan Offer: P{amount} approved for your number. Release today, low monthly. {cta}: {link}",
        "{greet}, your loan application is APPROVED. P{amount} is ready for release to your {wallet} account. Confirm here: {link}",
    ],
    "Personal Info Request": [
        "{greet}, this is {brand} verification. To keep your account active, reply with your full name, birthdate and account number.",
        "{agency} update: Please confirm your registered details (complete name, date of birth, address) to avoid suspension of benefits.",
        "{brand} Security: We detected incomplete records. Reply with your full name and the last 4 digits of your ID to continue.",
        "{greet}! Your {brand} profile is incomplete. Send your full name, address and mother's maiden name to verify {urgency}.",
    ],
    "Brand Impersonation": [
        "{brand}: Your account has been temporarily limited. Verify {urgency} to avoid permanent suspension: {link}",
        "{bank} Alert: Unusual login detected on your account. If this was not you, secure your account here: {link}",
        "{courier}: Your parcel is on hold due to an incomplete address. Update your details {urgency} or it will be returned: {link}",
        "{shop} Notice: Your order cannot be delivered. Confirm your shipping details here: {link}",
        "{telco} Rewards: You have unclaimed loyalty points expiring {urgency}. Claim via {link}",
        "{bank}: A transaction of P{amount} was attempted on your account. Cancel it {urgency}: {link}",
        "{wallet} Verification Required: your wallet will be deactivated if unverified. {cta}: {link}",
        "{wallet}: Your cash-in of P{amount} failed. Re-verify your account to release the funds: {link}",
        "{shop}: Your voucher of P{amount} is about to expire. Claim it {urgency} before it is forfeited: {link}",
        "{telco}: Your SIM registration is incomplete and will be deactivated {urgency}. Complete it here: {link}",
        "{bank}: your online banking access was suspended after 3 failed attempts. Restore it here: {link}",
        "{wallet} Alert: someone tried to change your registered number. If this was not you, {cta_tl}: {link}",
    ],
}

# --- wording-level variation rules for real seeds ---------------------------
# Deliberately *not* touching links/amounts/numbers: those are masked away, so
# changing them produces a row that de-duplicates against its own seed.
SWAPS: List[Tuple[str, List[str]]] = [
    (r"\bclick here\b", ["tap this link", "open this link", "visit this link"]),
    (r"\bclick\b", ["tap", "open"]),
    (r"\bverify\b", ["confirm", "validate", "re-confirm"]),
    (r"\bimmediately\b", ["right away", "within the day", "as soon as possible"]),
    (r"\bnow\b", ["today", "right now"]),
    (r"\baccount\b", ["acct", "account"]),
    (r"\bplease\b", ["pls", "kindly"]),
    (r"\burgent\b", ["URGENT", "important", "final notice"]),
    (r"\bcongratulations\b", ["Congrats", "Good news"]),
    # No Tagalog substitutions. The seeds in these four categories are 0.0%
    # "po", so swapping English for Taglish here does not vary a real message
    # -- it invents a marker the category has never carried.
    (r"\bhi\b", ["Hello", "Good day"]),
    (r"\byou have won\b", ["you won", "you are the winner of"]),
    (r"\bclaim\b", ["get", "redeem"]),
    (r"\bfree\b", ["FREE", "no charge"]),
    (r"\bdear customer\b", ["Dear valued customer", "Attention customer"]),
]


#: Two generated rows may not share more than this share of their masked
#: tokens. Exact-match de-duplication is not enough here: the amount, link and
#: number are all masked away, so "payout <AMOUNT> via GCash" and "payout
#: <AMOUNT> via Maya" differ by a single token once the model sees them. A
#: template bank left unchecked yields hundreds of rows like that -- more
#: volume, no more signal.
MAX_TOKEN_OVERLAP = 0.8


def _digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def _too_similar(masked: str, accepted: List[set]) -> bool:
    """Whether ``masked`` overlaps an already-accepted row past the threshold."""
    tokens = set(masked.split())
    if not tokens:
        return True
    for other in accepted:
        union = tokens | other
        if union and len(tokens & other) / len(union) > MAX_TOKEN_OVERLAP:
            return True
    return False


def load_rows(path: str) -> List[dict]:
    with open(path, encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def categorise(raw: str) -> List[str]:
    return [t.tag for t in tags_for_message(raw, preprocess(raw))]


def make_variant(seed_text: str, rng: random.Random) -> Optional[str]:
    """One wording-level variant, or ``None`` if nothing meaningful changed.

    Applies two to four substitutions plus an optional honorific/urgency
    insertion. Returns ``None`` when the result masks to the same string as
    the seed, since that row would be de-duplicated away anyway.
    """
    text = seed_text
    applicable = [(pat, reps) for pat, reps in SWAPS if re.search(pat, text, flags=re.IGNORECASE)]
    rng.shuffle(applicable)
    for pat, reps in applicable[: rng.randint(2, 4)]:
        text = re.sub(pat, rng.choice(reps), text, count=1, flags=re.IGNORECASE)

    roll = rng.random()
    if roll < 0.3:
        # English-only: a Tagalog greeting bolted onto a real English scam both
        # reads oddly and inflates the "po" rate the seeds do not have.
        text = f"{rng.choice(GREETINGS_EN)}, {text[0].lower() + text[1:]}"
    elif roll < 0.5:
        text = f"{text} {rng.choice(URGENCY_EN).capitalize()}."
    elif roll < 0.6:
        text = text.replace(" po ", " ")

    if preprocess(text) == preprocess(seed_text):
        return None
    return text


def _article(word: str) -> str:
    """ "a" or "an" to match ``word``. Without this, templates emit "a online
    encoder" -- grammatically wrong in a way that marks a row as machine-made."""
    return "an" if word[:1].lower() in "aeiou" else "a"


def make_authored(category: str, rng: random.Random, taglish_rate: float = 0.0) -> str:
    """One authored message for ``category``.

    ``taglish_rate`` is the share of rows allowed to use the Tagalog templates
    and honorifics, and callers pass the rate measured on the *real* Scam rows.
    Writing naturally here means writing "po" constantly, which is how the
    first pass ended up marking half its output with a token that is ten times
    commoner in Ham than in Scam.
    """
    brand_pool = WALLETS + BANKS + TELCOS
    job = rng.choice(JOB_TITLES)
    tagalog = rng.random() < taglish_rate and TEMPLATES_TL.get(category)
    bank = TEMPLATES_TL if tagalog else TEMPLATES
    return (
        rng.choice(bank[category])
        .replace("{greet}", rng.choice(GREETINGS_TL if tagalog else GREETINGS_EN))
        .replace("{cta_tl}", rng.choice(CTA_TL))
        .replace("{cta}", rng.choice(CTA_EN))
        # Account-closure deadlines only where an account is actually at stake.
        .replace(
            "{urgency}",
            rng.choice(
                (URGENCY_TL if tagalog else URGENCY_EN)
                + [
                    u
                    for u in (URGENCY_ACCOUNT if category == "Brand Impersonation" else [])
                    if ("ma-" in u) == bool(tagalog)
                ]
            ),
        )
        .replace("{link}", LINK.format(host=rng.choice(HOSTS[category])))
        .replace("{a_job}", f"{_article(job)} {job}")
        .replace("{job}", job)
        .replace("{pay}", rng.choice(["800", "1,200", "1,500", "2,000", "2,500"]))
        .replace("{amount}", rng.choice(["10,000", "25,000", "50,000", "75,000", "100,000"]))
        .replace("{wallet}", rng.choice(WALLETS))
        .replace("{bank}", rng.choice(BANKS))
        .replace("{brand}", rng.choice(brand_pool))
        .replace("{courier}", rng.choice(COURIERS))
        .replace("{shop}", rng.choice(SHOPS))
        .replace("{telco}", rng.choice(TELCOS))
        .replace("{agency}", rng.choice(AGENCIES))
    )


def generate(
    seeds_by_category: Dict[str, List[dict]],
    existing_counts: Counter,
    seen_masked: set,
    targets: Dict[str, int],
    variant_share: Dict[str, float],
    rng: random.Random,
    taglish_rate: float = 0.0,
) -> List[dict]:
    """Fill each category up to its target, mixing variants and authored rows."""
    out: List[dict] = []
    for category, target in targets.items():
        need = max(0, target - existing_counts.get(category, 0))
        if not need:
            continue
        want_variants = int(need * variant_share.get(category, 0.5))
        seeds = list(seeds_by_category.get(category, []))
        rng.shuffle(seeds)
        accepted_tokens: List[set] = []

        made = 0
        for seed in seeds:
            if made >= want_variants:
                break
            for _ in range(MAX_VARIANTS_PER_SEED):
                if made >= want_variants:
                    break
                text = make_variant(seed["text"], rng)
                if text is None or preprocess(text) in seen_masked:
                    continue
                seen_masked.add(preprocess(text))
                accepted_tokens.append(set(preprocess(text).split()))
                out.append(
                    {
                        "text": text,
                        "label": "Scam",
                        "category": category,
                        "origin": "variant",
                        "seed_id": _digest(preprocess(seed["text"])),
                    }
                )
                made += 1

        # Authored fills whatever the seeds could not -- which is most of it
        # for the thin categories, by design.
        # Language mix is a quota on *accepted* rows, not a per-attempt
        # probability. Sampling per attempt skewed it 14x above target: the
        # English bank exhausts, so English candidates are mostly rejected as
        # near-duplicates while the rare Tagalog ones are always novel and
        # always accepted. Rejection sampling reshapes any distribution fed
        # through it.
        tagalog_quota = round(need * taglish_rate)
        tagalog_made = 0
        attempts = 0
        exhausted = False
        while made < need and attempts < need * 200:
            attempts += 1
            want_tagalog = tagalog_made < tagalog_quota
            text = make_authored(category, rng, 1.0 if want_tagalog else 0.0)
            masked = preprocess(text)
            if masked in seen_masked or _too_similar(masked, accepted_tokens):
                continue
            seen_masked.add(masked)
            accepted_tokens.append(set(masked.split()))
            if want_tagalog:
                tagalog_made += 1
            out.append({"text": text, "label": "Scam", "category": category, "origin": "authored", "seed_id": ""})
            made += 1
        else:
            exhausted = made < need

        if exhausted:
            # Said out loud rather than silently returning a short batch: it
            # means the template bank cannot produce this many *distinct*
            # messages, and the honest fix is more templates or more real
            # seeds, not a looser similarity threshold.
            print(
                f"  NOTE  {category}: produced {made} of {need} requested -- the template bank "
                f"ran out of distinct messages at {MAX_TOKEN_OVERLAP:.0%} overlap."
            )
    return out


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sample", action="store_true", help="Generate a few rows per category and write nothing.")
    parser.add_argument("--sample-size", type=int, default=6)
    parser.add_argument("--seed", type=int, default=20260916, help="Fixes the RNG so a batch is reproducible.")
    parser.add_argument("--out-dir", default=OUT_DIR)
    args = parser.parse_args(list(argv) if argv is not None else None)

    rng = random.Random(args.seed)

    pool = load_rows(LABELED_CSV)
    scam_rows = [r for r in pool if r["label"] == "Scam"]
    holdout_masked = {preprocess(r["text"]) for r in load_rows(HOLDOUT_CSV)} if os.path.isfile(HOLDOUT_CSV) else set()

    seeds_by_category: Dict[str, List[dict]] = {}
    existing = Counter()
    excluded_by_holdout = 0
    excluded_as_suspect = 0
    for row in scam_rows:
        cats = categorise(row["text"])
        for cat in set(cats):
            existing[cat] += 1
        if preprocess(row["text"]) in holdout_masked:
            excluded_by_holdout += 1
            continue  # never seed from a message the model is graded on
        if SUSPECT_SEED.search(row["text"]):
            excluded_as_suspect += 1
            continue  # pending human re-labelling; see SUSPECT_SEED
        for cat in set(cats):
            if cat in TARGETS:
                seeds_by_category.setdefault(cat, []).append(row)

    seen_masked = {preprocess(r["text"]) for r in pool} | holdout_masked

    if args.sample:
        targets = {c: existing.get(c, 0) + args.sample_size for c in TARGETS}
    else:
        targets = TARGETS

    variant_share = {
        # Thin categories have too few real messages to vary without repeating
        # themselves, so they lean authored; the richer ones lean variant.
        "Fake Job Offer": 0.3,
        "Unsolicited Credit Offer": 0.3,
        "Personal Info Request": 0.3,
        "Brand Impersonation": 0.6,
    }
    # Match the real Scam rows' politeness-marker rate rather than writing
    # naturally, for the reason spelled out above TEMPLATES_TL.
    taglish_rate = sum(1 for r in scam_rows if re.search(r"\bpo\b", r["text"], re.I)) / max(len(scam_rows), 1)
    rows = generate(seeds_by_category, existing, seen_masked, targets, variant_share, rng, taglish_rate)

    print(
        f"Scam rows in pool: {len(scam_rows)}   "
        f"seeds excluded -- in the holdout: {excluded_by_holdout}, "
        f"suspected mislabel: {excluded_as_suspect}"
    )
    print("\ncategory                    real   +new   origin split")
    for cat in TARGETS:
        new = [r for r in rows if r["category"] == cat]
        split = Counter(r["origin"] for r in new)
        print(
            f"  {cat:26}{existing.get(cat, 0):>5}{len(new):>7}   "
            f"variant {split.get('variant', 0)}, authored {split.get('authored', 0)}"
        )

    total_scam_after = len(scam_rows) + len(rows)
    share = len(rows) / total_scam_after if total_scam_after else 0
    print(f"\nsynthetic share of the Scam class after this batch: {share:.1%} (cap {MAX_SYNTHETIC_SHARE:.0%})")
    if share > MAX_SYNTHETIC_SHARE:
        print("  WARNING over cap -- lower the targets, or gather more real scams first.")

    # Distribution check. A marker that is commoner in the synthetic rows than
    # in the real ones is a correlation this batch would *invent*, and the
    # model would learn it as readily as any real signal.
    ham_rows = [r for r in pool if r["label"] == "Ham"]
    print("\nmarker                 real Ham   real Scam   synthetic")
    for marker, pattern in (
        ("po", r"\bpo\b"),
        ("ninyo/kayo", r"\b(ninyo|kayo)\b"),
        ("ALL CAPS word", r"\b[A-Z]{4,}\b"),
    ):

        def rate(rows_):
            return (
                100
                * sum(1 for r in rows_ if re.search(pattern, r["text"], re.I if marker != "ALL CAPS word" else 0))
                / max(len(rows_), 1)
            )

        r_ham, r_scam, r_syn = rate(ham_rows), rate(scam_rows), rate(rows)
        flag = "  <-- over-represented" if r_syn > max(r_scam * 3, r_scam + 5) else ""
        print(f"  {marker:20}{r_ham:>7.1f}%{r_scam:>11.1f}%{r_syn:>11.1f}%{flag}")

    if args.sample:
        print("\n--- sample (authored rows only; variants derive from real messages and are not printed) ---")
        for cat in TARGETS:
            print(f"\n{cat}:")
            for row in [r for r in rows if r["category"] == cat and r["origin"] == "authored"][:3]:
                print(f"  - {row['text']}")
        print("\nSample run: nothing written. Drop --sample to generate the full batch.")
        return 0

    os.makedirs(args.out_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    out_csv = os.path.join(args.out_dir, f"scam_augmentation_{stamp}.csv")
    with open(out_csv, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["text", "label", "category", "origin", "seed_id"])
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rng_seed": args.seed,
        "n_generated": len(rows),
        "by_category": {c: Counter(r["origin"] for r in rows if r["category"] == c) for c in TARGETS},
        "existing_scam_rows": len(scam_rows),
        "synthetic_share_after": round(share, 4),
        "seeds_excluded_for_being_in_holdout": excluded_by_holdout,
        "max_variants_per_seed": MAX_VARIANTS_PER_SEED,
        "note": (
            "Synthetic Scam rows for review. NOT merged into datasets/labeled/ by this script. "
            "The holdout stays entirely real: no row here may enter it, and no seed came from it."
        ),
    }
    with open(os.path.join(args.out_dir, f"scam_augmentation_{stamp}.json"), "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True, default=dict)
    print(f"\nWrote {out_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
