"""Review sheet: NTC/FOI rows still carrying the blanket "scam" label.

Found 2026-09-17, the same way the institutional mislabels were found the day
before -- by reviewing generated augmentation data and tracing a bad variant
back to the real message that seeded it. That message was:

    "You're pre-approved for the Atome Card with upto P20K spending limit to
     shop hassle-free for Christmas! Activate now: <URL>"

labeled **Scam**, and checked against every ``review_sheet*.csv`` in
``datasets/audit/`` by exact normalised text, it had **never appeared in any
review round at all.**

**Why a whole sheet rather than a one-row fix.** The FOI source file
(``bantAI-datasets/NTC/FOI-TEST-DATASET.csv``) carries ``label=scam`` on all
373 of its rows -- a blanket stamp applied when the corpus was assembled, not a
per-message judgement, and ``build_dataset.py`` hardcodes ``reconcile("Scam",
...)`` to match it. That is the same shape of problem already found and fixed
once on the Kaggle corpora, but the NTC half is far less reviewed: of the 299
NTC rows that reach training, **295 are still Scam**, and the only four ever
overturned were overturned by rules, never by a person.

The build already treats these rows as untrusted (``trusted=False``, "citizen
reports: suspected, not verified"), so a rule finding positive Ham/Spam
evidence can override the stamp. What it cannot do is notice a legitimate
promo that simply does not trip any rule -- which is exactly what the Atome row
is, and exactly what a human sampling this sheet will catch.

**What is *not* claimed here.** A reported message being legitimate is not
surprising or embarrassing: NTC's FOI release is a list of messages citizens
*reported*, and citizens report things that turn out to be real promos. The
error is in treating "reported" as "confirmed scam" at import time, not in the
source data.

Rows already reviewed in an earlier round are excluded, matched on normalised
text so Excel's punctuation mangling (Bug History §5) does not resurface a row
as unreviewed.

Writes ``datasets/audit/review_sheet_ntc_2026-09-17.csv`` in the format
``apply_review_corrections.py`` already discovers and applies (any
``review_sheet*.csv`` in that directory). Fill in ``verdict`` (AGREE /
DISAGREE) and, for DISAGREE, ``correct_label`` (Ham / Spam / Scam).

Run:
    cd ai && .venv/Scripts/python.exe scripts/make_ntc_review_sheet.py
    cd ai && .venv/Scripts/python.exe scripts/make_ntc_review_sheet.py --limit 60
"""

from __future__ import annotations

import argparse
import csv
import glob
import os
import re
import sys

sys.path.insert(0, ".")

from preprocessing.masking import URL_RE  # noqa: E402
from service.indicator_tags import is_official_domain  # noqa: E402

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

LABELED_CSV = "datasets/labeled/bantai_labeled.csv"
AUDIT_DIR = "datasets/audit"
OUT_CSV = "datasets/audit/review_sheet_ntc_2026-09-17.csv"

#: Wording that makes a *reported* message more likely to be a real one. Not
#: evidence -- a scam impersonating Shopee says "Shopee" too -- only a reason to
#: put a row nearer the top of a reviewer's queue. The reviewer decides.
LIKELY_LEGITIMATE = [
    (
        re.compile(r"\b(pre-?approved|spending limit|installment|cashback|voucher)\b", re.I),
        "credit/promo offer wording",
    ),
    (re.compile(r"\b(successfully|confirmed|processed|received|delivered|activated)\b", re.I), "confirmation wording"),
    (re.compile(r"\b(unsubscribe|opt-?out|reply stop|do not reply|noreply)\b", re.I), "opt-out footer"),
    (re.compile(r"\b(verification code|otp|one-?time pin|do not share)\b", re.I), "OTP notice"),
    (re.compile(r"\b(gcash|maya|shopee|lazada|globe|smart|dito|bdo|bpi|grab|foodpanda)\b", re.I), "names a real brand"),
]

FIELDS = [
    "id",
    "verdict",
    "correct_label",
    "notes",
    "text",
    "rule_label",
    "confidence",
    "reason",
    "language",
    "source",
    "source_label",
    "sender",
]


def normalise(text: str) -> str:
    """Alphanumerics only, lowercased -- survives Excel punctuation mangling."""
    return "".join(ch.lower() for ch in text if ch.isalnum())


def already_reviewed(audit_dir: str) -> set:
    """Normalised text of every row any existing review sheet already covers."""
    seen = set()
    for path in glob.glob(os.path.join(audit_dir, "review_sheet*.csv")):
        if os.path.abspath(path) == os.path.abspath(OUT_CSV):
            continue
        try:
            with open(path, encoding="utf-8-sig", newline="") as handle:
                for row in csv.DictReader(handle):
                    text = (row.get("text") or "").strip()
                    if text:
                        seen.add(normalise(text))
        except (OSError, csv.Error):
            continue
    return seen


#: Link shorteners and redirectors. A legitimate brand rarely needs one; a scam
#: almost always does, to hide the destination. ``shorten.tv`` and ``free.
#: queen.ph`` are both in this corpus.
_SHORTENERS = re.compile(
    r"\b(bit\.ly|tinyurl|t\.co|is\.gd|cutt\.ly|rb\.gy|shorturl|ow\.ly|rebrand\.ly|shorten\.\w+|\w{0,6}short\w*\.\w+)\b",
    re.I,
)


#: A bare IP address in place of a domain. No legitimate brand sends one, and
#: ``URL_RE`` does not treat it as a link, so without this it scored as
#: "no link at all" -- the highest-legitimacy bucket. Found ranked first in the
#: generated sheet: "Free register bonus and welcome bonus 1688 on 8.212.144.179".
_RAW_IP = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
#: "Contact me on Telegram/Instagram" instead of a link. Same failure mode --
#: no URL, so it looked link-free and therefore harmless.
_OFF_PLATFORM = re.compile(r"\b(telegram|whatsapp|viber|instagram|wechat|messenger)\s*[:@]", re.I)


def _hosts(text: str) -> list:
    """Hostnames of every link in the message.

    Uses the pipeline's own ``URL_RE`` rather than a local pattern. A first
    version here matched only ``https?://...`` and was badly wrong: SMS scams
    routinely write a bare domain, and the three highest-ranked rows of the
    first generated sheet ("...clicking the link below ... shorten.tv/
    gcashmobile") were scored as *link-free* and sorted to the top of the
    queue, which is the opposite of what the ordering is for. ``URL_RE``
    already handles bare domains -- it is what turns ``gcash-promo.xyz`` into
    ``<URL>`` in the manuscript's own worked example.
    """
    out = []
    for match in URL_RE.findall(text):
        host = re.sub(r"^h(?:tt|xx)ps?://", "", match, flags=re.I).split("/")[0]
        if host:
            out.append(host.lower())
    return out


def link_score(text: str) -> int:
    """How much the message's links argue for it being legitimate.

    2 = no link at all, or every link is on an official brand domain.
    1 = has a link, not a shortener, not recognisably official.
    0 = uses a shortener or redirector.
    """
    if _SHORTENERS.search(text) or _RAW_IP.search(text) or _OFF_PLATFORM.search(text):
        return 0
    hosts = _hosts(text)
    if not hosts:
        return 2
    if all(is_official_domain(h) for h in hosts):
        return 2
    return 1


def why(text: str) -> str:
    hits = [label for pattern, label in LIKELY_LEGITIMATE if pattern.search(text)]
    link = {2: "no link, or an official domain", 1: "unrecognised link", 0: "link shortener"}[link_score(text)]
    return "; ".join(hits + [link]) if hits else link


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--labeled", default=LABELED_CSV)
    parser.add_argument("--audit-dir", default=AUDIT_DIR)
    parser.add_argument("--out", default=OUT_CSV)
    parser.add_argument("--source", default="ntc", help="Source stamp to review (default: ntc).")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only the first N rows, highest-suspicion first. A short sheet that gets finished "
        "beats a long one that does not.",
    )
    parser.add_argument(
        "--include-reviewed",
        action="store_true",
        help="Do not skip rows an earlier sheet already covered.",
    )
    args = parser.parse_args(argv)

    with open(args.labeled, encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    reviewed = set() if args.include_reviewed else already_reviewed(args.audit_dir)

    candidates = [
        r
        for r in rows
        if r.get("source") == args.source
        and r.get("label") == "Scam"
        and (args.include_reviewed or normalise(r.get("text", "")) not in reviewed)
    ]
    # Most-likely-legitimate first: a reviewer working top-down finds the real
    # mislabels early, and a sheet abandoned halfway has still done its job.
    #
    # Ordering by the LIKELY_LEGITIMATE wording alone was tried first and is
    # actively misleading: "you have received P5,000 from DSWD AKAP via GCash"
    # matches *both* "confirmation wording" and "names a real brand", and is
    # the single commonest cash-aid scam in this corpus. Wording cannot
    # separate a real promo from a scam imitating one -- that is the whole
    # reason this sheet needs a human.
    #
    # The link is the discriminator that actually works. A legitimate brand
    # message links to that brand's own domain or carries no link at all; the
    # scams here run on shorteners and lookalikes (bit.ly, gcashil.com). So
    # rank by link character first, and use the wording only to break ties.
    candidates.sort(
        key=lambda r: (
            -link_score(r.get("text", "")),
            -sum(1 for p, _ in LIKELY_LEGITIMATE if p.search(r.get("text", ""))),
        )
    )
    skipped = sum(1 for r in rows if r.get("source") == args.source and r.get("label") == "Scam") - len(candidates)

    if args.limit:
        candidates = candidates[: args.limit]

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for i, row in enumerate(candidates, start=1):
            writer.writerow(
                {
                    "id": f"NTC-{i:04d}",
                    "verdict": "",
                    "correct_label": "",
                    "notes": "",
                    "text": row.get("text", ""),
                    "rule_label": "Scam",
                    "confidence": "",
                    "reason": why(row.get("text", "")),
                    "language": row.get("language", ""),
                    "source": row.get("source", ""),
                    "source_label": "scam (blanket, from the FOI source file)",
                    "sender": row.get("sender", ""),
                }
            )

    print(f"Wrote {args.out} -- {len(candidates)} rows to review")
    if skipped:
        print(f"  skipped {skipped} already covered by an earlier review sheet")
    print("\n  reason                                rows")
    counts: dict = {}
    for row in candidates:
        counts[why(row.get("text", ""))] = counts.get(why(row.get("text", "")), 0) + 1
    for reason, n in sorted(counts.items(), key=lambda kv: -kv[1])[:10]:
        print(f"  {reason:38}{n:>5}")
    print(
        "\nFill in verdict (AGREE / DISAGREE) and, for DISAGREE, correct_label.\n"
        "Then run: .venv/Scripts/python.exe scripts/apply_review_corrections.py\n"
        "Save as CSV, not xlsx -- Excel mangles curly punctuation (Bug History section 5)."
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
