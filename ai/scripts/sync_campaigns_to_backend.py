"""Push the latest clustering run (campaign_clusters.json) into the backend.

The live service loads centroids from the backend, not from the local file, so
this must run after every re-clustering -- i.e. after every model promotion.

    cd ai && python scripts/sync_campaigns_to_backend.py           # dry run
    cd ai && python scripts/sync_campaigns_to_backend.py --apply

Creates the new clusters first, then deactivates (never deletes) the old ones,
so a failure part-way never leaves the backend with no active campaigns.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from typing import Callable, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from service.config import settings  # noqa: E402
from service.indicator_tags import is_official_domain, is_shortener  # noqa: E402

CLUSTER_FILE = os.path.join("datasets", "processed", "campaign_clusters.json")

# General-purpose sites scammers also use. Hiding these would hide every
# ordinary link to them from non-contacts. Extend when a new one turns up.
_SHARED_PLATFORMS = {"facebook.com", "onelink.to"}

# Same hostname rule the backend enforces on PATCH /campaigns/:id/domains.
_HOSTNAME_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$", re.I)

Request = Callable[[str, str, Optional[dict]], object]


def suppression_domains(cluster: dict) -> List[str]:
    """Domains the backend may hide links for -- Scam-majority clusters only.

    The backend strips any link whose domain belongs to an active cluster.
    Spam clusters are honest marketing (official Globe/DITO/GCash promos), so
    copying their domains would hide legitimate links. Shorteners are left out
    because the backend already hides them through its own list.
    """
    labels = cluster.get("labels", {})
    if labels.get("Scam", 0) <= labels.get("Spam", 0):
        return []
    out: List[str] = []
    for domain in cluster.get("top_domains", []):
        domain = domain.lower()
        if (
            _HOSTNAME_RE.match(domain)
            and not is_official_domain(domain)
            and not is_shortener(domain)
            and not _is_shared_platform(domain)
            and domain not in out
        ):
            out.append(domain)
    return out


def _is_shared_platform(host: str) -> bool:
    return any(host == d or host.endswith(f".{d}") for d in _SHARED_PLATFORMS)


def build_payloads(data: dict) -> List[dict]:
    """One POST /campaigns body per cluster. No ``lexical`` key: the backend
    has no column for it and rejects unknown fields (forbidNonWhitelisted)."""
    return [
        {
            "label": f"cluster-{c['cluster_id']}",
            "centroid": c["centroid"],
            "urlDomains": suppression_domains(c),
        }
        for c in data.get("clusters", [])
        if c.get("centroid")
    ]


def make_request(base_url: str, api_key: str, max_retries: int = 10) -> Request:
    def request(method: str, path: str, body: Optional[dict] = None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            base_url.rstrip("/") + path,
            data=data,
            method=method,
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
        )
        for attempt in range(max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
                    raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else None
            except urllib.error.HTTPError as exc:
                # The backend allows 120 requests/min per IP; a full sync needs ~520.
                if exc.code != 429 or attempt == max_retries:
                    raise
                wait = _retry_after_seconds(exc.headers)
                print(f"  rate-limited by the backend, waiting {wait}s...", flush=True)
                time.sleep(wait)

    return request


def _retry_after_seconds(headers) -> int:
    # @nestjs/throttler suffixes the header with the throttler name (Retry-After-global).
    for name, value in (headers or {}).items():
        if name.lower().startswith("retry-after") and str(value).strip().isdigit():
            return int(value) + 1
    return 60


def sync(payloads: List[dict], request: Request) -> tuple:
    """Create every new cluster, then deactivate the previously active ones.

    If any create fails, the clusters created so far are deactivated again and
    the old set is left untouched. Returns ``(created_ids, deactivated_ids)``.
    """
    old_ids = [c["id"] for c in request("GET", "/campaigns/centroids", None)]

    created: List[str] = []
    try:
        for body in payloads:
            created.append(request("POST", "/campaigns", body)["id"])
    except Exception:
        for cid in created:
            request("PATCH", f"/campaigns/internal/{cid}/deactivate", None)
        raise

    deactivated: List[str] = []
    for cid in old_ids:
        request("PATCH", f"/campaigns/internal/{cid}/deactivate", None)
        deactivated.append(cid)
    return created, deactivated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="actually write to the backend (default: dry run)")
    parser.add_argument("--file", default=CLUSTER_FILE)
    args = parser.parse_args()

    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    payloads = build_payloads(data)
    with_domains = [p for p in payloads if p["urlDomains"]]
    all_domains = sorted({d for p in payloads for d in p["urlDomains"]})

    print(f"{args.file}: {len(payloads)} clusters (match_threshold {data.get('match_threshold')})")
    print(f"  {len(with_domains)} clusters contribute link-suppression domains, {len(all_domains)} distinct:")
    print("  " + (", ".join(all_domains) or "(none)"))

    if not settings.campaigns_api_key:
        print("\nBANTAI_AI_CAMPAIGNS_API_KEY is not set in ai/.env -- it must match AI_CAMPAIGNS_API_KEY.")
        return 1

    request = make_request(settings.backend_url, settings.campaigns_api_key)
    try:
        current = request("GET", "/campaigns/centroids", None)
    except urllib.error.HTTPError as exc:
        print(f"\nBackend answered {exc.code} -- check BANTAI_AI_CAMPAIGNS_API_KEY matches AI_CAMPAIGNS_API_KEY.")
        return 1
    except urllib.error.URLError as exc:
        print(f"\nCould not reach {settings.backend_url}: {exc}. Is the backend running?")
        return 1
    print(f"\nBackend {settings.backend_url}: {len(current)} active clusters now.")

    if not args.apply:
        print(f"Dry run. --apply would create {len(payloads)} and deactivate those {len(current)}.")
        return 0

    created, deactivated = sync(payloads, request)
    print(f"Created {len(created)}, deactivated {len(deactivated)}. Restart the AI service to load them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
