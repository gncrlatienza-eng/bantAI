"""Live round-trip walkthrough (Sprint 4, WBS 4.4.3): report -> validate ->
retrain -> deploy, exercised end to end against a real backend, a real AI
service, and real (if tiny) model inference.

Supersedes the untracked `verify.ps1` at the repo root, which could not run
past its second phase -- it called `seed.sql` and `cleanup.ps1`, and neither
file exists in the repo. This is Python, not PowerShell, so it runs the same
way on any teammate's machine; its two solid checks (the database source is
actually used, a wrong API key fails loudly rather than reporting zero) carry
forward unchanged, alongside the new stages this closes: the retrain-trigger
queue (`POST /retrain`) and model registration (`POST /models`).

This is the **live** counterpart to `tests/test_round_trip.py`, which proves
the same wiring in CI with everything stubbed. This script talks to real
services and writes real (temporary, cleaned-up) rows -- use it as the WBS
4.5.1 Sprint 4 demo, not as a CI gate.

**What this never does:** activate a candidate as the live model, or touch
`ai/models/xlm-roberta-smishing/` (the deployed checkpoint). The model stage
scores the baseline against *itself* -- a real forward pass through the real
gate, not a training run -- which is enough to prove every piece of plumbing
without risking the checkpoint that is actually serving traffic. Any
ModelVersion this script registers is tagged `vROUNDTRIP-TEST-...` and is
never activated.

Needs, running, before you start:
    docker compose up -d                                   (repo root)
    cd backend && npm run start:dev
    cd ai && .venv/Scripts/python.exe -m uvicorn service.main:app --port 8001
    backend/.env has INTERNAL_API_KEY set (this script checks; it does not
    set it for you -- see phase 0)

Run:
    cd ai && .venv/Scripts/python.exe scripts/round_trip.py
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, ".")

from preprocessing.pipeline import preprocess  # noqa: E402
from retraining.pipeline import evaluate_candidate  # noqa: E402
from retraining.registry import ModelRegistry, ModelRegistryError  # noqa: E402
from retraining.reports import DatabaseReportSource, ReportSourceError  # noqa: E402
from training.config import LABEL2ID  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
PG_CONTAINER = "bantai-postgres-1"
PG_DB = ["-U", "bantai", "-d", "bantai_db"]
BACKEND_URL = "http://localhost:3000/api"
AI_SERVICE_URL = "http://localhost:8001"

# Fixed ids so the script is idempotent: re-running cleans up its own prior
# rows first rather than accumulating duplicates. Prefixed distinctly so
# nobody mistakes these for real user data in a shared dev database.
TEST_USER_ID = "00000000-0000-4000-8000-00000000ffff"
# One message per report, not one shared message: UserReport has
# @@unique([userId, messageId]), so this one user can report each message
# only once -- three reports need three distinct messages.
TEST_MESSAGE_IDS = {
    "Validated": "00000000-0000-4000-8000-00000000dddd",
    "Pending": "00000000-0000-4000-8000-00000000eeee",
    "Rejected": "00000000-0000-4000-8000-00000000ffff",
}
TEST_REPORT_IDS = {
    "Validated": "00000000-0000-4000-8000-00000000aaaa",
    "Pending": "00000000-0000-4000-8000-00000000bbbb",
    "Rejected": "00000000-0000-4000-8000-00000000cccc",
}

_PASS = "PASS"
_FAIL = "FAIL"
_failures: list = []


def step(title: str) -> None:
    print(f"\n=== {title} ===")


def check(ok: bool, label: str) -> bool:
    print(f"  [{_PASS if ok else _FAIL}] {label}")
    if not ok:
        _failures.append(label)
    return ok


# --- phase 0: preconditions -------------------------------------------------- #
def phase0_preconditions(api_key: str) -> bool:
    step("0. Preconditions")

    env_path = REPO_ROOT / "backend" / ".env"
    if not env_path.is_file():
        check(False, "backend/.env exists (copy backend/.env.example and fill it in)")
        return False
    env_text = env_path.read_text(encoding="utf-8")
    has_key = any(
        line.strip().startswith("INTERNAL_API_KEY=") and line.strip() != "INTERNAL_API_KEY="
        for line in env_text.splitlines()
    )
    if not check(has_key, "backend/.env has INTERNAL_API_KEY set"):
        print(f"        Add a line like: INTERNAL_API_KEY={api_key}")
        print("        then restart the backend (npm run start:dev) and re-run this script.")
        return False

    result = subprocess.run(
        ["docker", "exec", PG_CONTAINER, "psql", *PG_DB, "-t", "-c", "\\dt"],
        capture_output=True,
        text=True,
    )
    if not check(result.returncode == 0 and "UserReport" in result.stdout, "UserReport table exists"):
        print("        Is `docker compose up -d` running? Has the Sprint 4 migration been applied?")
        print("        cd backend && npx prisma migrate deploy --schema=database/prisma/schema.prisma")
        return False

    return True


# --- phase 1-2: report -> validate ------------------------------------------- #
def _psql(sql: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER, "psql", *PG_DB, "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
    )


def _cleanup_seed() -> None:
    """Remove this script's own rows. Safe to call whether or not they exist."""
    report_ids = "', '".join(TEST_REPORT_IDS.values())
    message_ids = "', '".join(TEST_MESSAGE_IDS.values())
    _psql(f"DELETE FROM \"UserReport\" WHERE id IN ('{report_ids}');")
    _psql(f"DELETE FROM \"SmsMessage\" WHERE id IN ('{message_ids}');")
    _psql(f"DELETE FROM \"User\" WHERE id = '{TEST_USER_ID}';")


def phase1_seed_reports() -> bool:
    """Seed one User + three SmsMessages + three UserReports: Validated /
    Pending / Rejected -- the report -> validate half of the round trip, done
    directly against Postgres because there is no dev-mode way to read a
    generated OTP through the API (`OtpSmsService` only *logs* that it
    skipped delivery, it never returns the code)."""
    step("1. Seed report -> validate (one Validated, one Pending, one Rejected)")

    _cleanup_seed()  # idempotent: clear any leftovers from a previous run first

    message_values = ",\n      ".join(
        f"('{TEST_MESSAGE_IDS[status]}', '{TEST_USER_ID}', '09171234567', "
        f"'Your account will be blocked. Verify at http://bpi-secure-verify.ph ({status})', now())"
        for status in TEST_MESSAGE_IDS
    )
    report_values = ",\n      ".join(
        f"('{TEST_REPORT_IDS[status]}', '{TEST_USER_ID}', '{TEST_MESSAGE_IDS[status]}', "
        f"'Spam', '{'Ham' if status == 'Rejected' else 'Scam'}', '{status}', now(), now())"
        for status in TEST_REPORT_IDS
    )
    sql = f"""
    INSERT INTO "User" (id, phone, "createdAt", "updatedAt")
    VALUES ('{TEST_USER_ID}', '+639000000000', now(), now());

    INSERT INTO "SmsMessage" (id, "userId", sender, body, "receivedAt")
    VALUES
      {message_values};

    INSERT INTO "UserReport"
        (id, "userId", "messageId", "originalLabel", "reportedLabel", status, "createdAt", "updatedAt")
    VALUES
      {report_values};
    """
    result = _psql(sql)
    return check(result.returncode == 0, f"seed applied ({result.stderr.strip() or 'ok'})")


def phase2_read_via_database_source(api_key: str) -> bool:
    step("2. DatabaseReportSource reads the live table")

    ok = True
    source = DatabaseReportSource(BACKEND_URL, api_key)
    try:
        reports = source.fetch()
    except ReportSourceError as exc:
        return check(False, f"correct key reads reports without raising ({exc})")

    ok &= check(len(reports) == 1, f"kept exactly the Validated report (got {len(reports)})")
    ok &= check("database:" in source.describe(), "describe() reports the database source, not file/null")
    described = source.describe()
    ok &= check("1 of 3 reports" in described or "1 of" in described, f"describe(): {described}")

    bad = DatabaseReportSource(BACKEND_URL, "definitely-not-the-real-key")
    try:
        bad.fetch()
        ok &= check(False, "a wrong key raises instead of returning an empty list")
    except ReportSourceError as exc:
        ok &= check("401" in str(exc), f"a wrong key fails loudly with a 401 hint ({exc})")

    return ok


# --- phase 3: the retrain trigger queue (new in WBS 4.4.3) ------------------- #
def _post_json(url: str, payload: dict) -> tuple:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:  # noqa: S310
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # An unexpected non-JSON error body (a raw 500 traceback, a proxy's
        # HTML error page) must still show up as a clean FAIL line -- the
        # whole point of this script's check() helper -- rather than crashing
        # this smoke test on an unrelated JSONDecodeError.
        body_text = exc.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(body_text)
        except json.JSONDecodeError:
            body = {"error": body_text[:500]}
        return exc.code, body


def _get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def phase3_retrain_trigger() -> bool:
    step("3. POST /retrain (the endpoint that used to 404) + GET /retrain/jobs")

    ok = True
    try:
        status, body = _post_json(f"{AI_SERVICE_URL}/retrain", {"trigger": "validated_report_count"})
    except urllib.error.URLError as exc:
        return check(False, f"AI service reachable at {AI_SERVICE_URL} ({exc})")

    ok &= check(status == 202, f"POST /retrain returns 202 (got {status})")
    ok &= check(body.get("status") == "queued", f"job recorded as queued (got {body})")
    job_id = body.get("job_id")

    status2, body2 = _post_json(f"{AI_SERVICE_URL}/retrain", {"trigger": "validated_report_count"})
    ok &= check(body2.get("job_id") == job_id, "a repeat trigger dedupes to the same job, not a second row")

    jobs = _get_json(f"{AI_SERVICE_URL}/retrain/jobs").get("jobs", [])
    ok &= check(any(j["job_id"] == job_id for j in jobs), "GET /retrain/jobs shows the queued job")

    return ok


# --- phase 4: the gate, for real -- baseline scored against itself ---------- #
def phase4_gate(baseline_dir: str, scratch_dir: str) -> tuple:
    step("4. Promotion gate, run for real (baseline scored against itself)")

    print("  Loading the deployed checkpoint twice and scoring it against the")
    print("  small format-reference set (datasets/labeled/sample.csv) -- proves")
    print("  the real predict -> McNemar -> decision.json path without training.")

    import csv

    # evaluate_candidate writes disagreements.json into run_dir but does not
    # create it -- run_retraining's own caller does that first
    # (os.makedirs before write_snapshot); this script is a second caller of
    # the same contract and has to uphold it too.
    Path(scratch_dir).mkdir(parents=True, exist_ok=True)

    rows = list(csv.DictReader(open("datasets/labeled/sample.csv", encoding="utf-8")))
    texts = [preprocess(r["text"]) for r in rows]
    labels = [LABEL2ID[r["label"]] for r in rows]

    try:
        decision = evaluate_candidate(baseline_dir, baseline_dir, texts, labels, run_dir=scratch_dir)
    except (OSError, RuntimeError, ValueError) as exc:
        check(False, f"gate produced a decision ({exc}; is {baseline_dir} a real checkpoint?)")
        return False, None

    ok = check(decision is not None, "gate produced a decision")
    ok &= check(
        decision.n_fixes == 0 and decision.n_regressions == 0,
        f"identical checkpoints disagree on nothing (fixes={decision.n_fixes}, regressions={decision.n_regressions})",
    )
    ok &= check(not decision.promote, "identical checkpoints are correctly not 'promoted'")
    return ok, decision


# --- phase 5: register (never activate) -------------------------------------- #
def phase5_register(api_key: str, decision) -> bool:
    step("5. Register a TEST ModelVersion (never activated)")

    version_tag = f"vROUNDTRIP-TEST-{uuid.uuid4().hex[:12]}"
    registry = ModelRegistry(BACKEND_URL, api_key)
    try:
        model_id = registry.register(
            version_tag=version_tag,
            f1_score=decision.candidate_macro_f1,
            notes="round_trip.py smoke test -- safe to delete from ModelVersions.",
        )
    except ModelRegistryError as exc:
        return check(False, f"POST /models succeeds ({exc})")

    ok = check(bool(model_id), f"registered {version_tag} as {model_id}")

    active = registry.get_active()
    ok &= check(
        (active or {}).get("versionTag") != version_tag,
        "the TEST version was NOT activated -- the real active model is unchanged",
    )
    print(f"        (leaving {version_tag} / {model_id} registered and inactive; delete via psql if you want it gone)")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--api-key", default="dev-internal-key-4335", help="Must match backend/.env's INTERNAL_API_KEY."
    )
    parser.add_argument("--baseline", default="models/xlm-roberta-smishing", help="Deployed checkpoint to score.")
    parser.add_argument("--keep-seed", action="store_true", help="Don't delete the seeded report rows at the end.")
    args = parser.parse_args()

    if not phase0_preconditions(args.api_key):
        return 1

    try:
        phase1_seed_reports()
        phase2_read_via_database_source(args.api_key)
        phase3_retrain_trigger()
        gate_ok, decision = phase4_gate(args.baseline, "models/retraining_runs/round-trip-scratch")
        if decision is not None:
            phase5_register(args.api_key, decision)
    finally:
        if not args.keep_seed:
            step("Cleanup")
            _cleanup_seed()
            print("  seeded report rows removed.")

    print()
    if _failures:
        print(f"==================== {len(_failures)} CHECK(S) FAILED ====================")
        for f in _failures:
            print(f"  - {f}")
        return 1

    print("==================== ALL CHECKS PASSED ====================")
    print("Nothing was promoted: the deployed checkpoint and the backend's active")
    print("ModelVersion are exactly as they were before this ran.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
