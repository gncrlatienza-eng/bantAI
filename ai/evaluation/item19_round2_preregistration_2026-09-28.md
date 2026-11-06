# Item 19, round 2 — search for further fixes, rules written before measuring (2026-09-28)

Round 1 (`item19_preregistration_2026-09-28.md`) left:
- scam messages matching their own campaign: 56.6%
- scams in no campaign: 74%
- backend path (embedding tier only): Scam wrong-campaign 2.1%, over the 2% limit

Round 2 tries many more options. Trying many options and keeping the best on
the same data flatters the winner, so this round is split in two:

## 1. A confirmation set, locked away first

Before anything is tried, **20% of the Spam+Scam population** (random, seed
20260928, fixed in `item19_round2.py`) is set aside. No exploration step
sees it — not the transform fit, not the clustering, not any threshold search.

## 2. Exploration (on the other 80%)

Candidates, each marked **[A]** adoptable as an implementation detail of the
approved item 19, or **[M]** a manuscript deviation — measured for
information only, adoptable only with adviser approval:

| Family | Values | |
|---|---|---|
| directions removed `k` | 1, 2, 3, 4, 6, 8 | [A] |
| population the transform is fitted on | Spam+Scam; Scam only | [A] |
| dimension reduction before HDBSCAN (PCA; UMAP if it installs) | none; 10; 25; 50 dims | [A] |
| HDBSCAN `min_samples` / method / epsilon | 1–2 / eom, leaf / 0 (epsilon > 0 only if a working implementation installs) | [A] |
| per-cluster threshold: bar = min(label bar, that cluster's own 10th-percentile member similarity) | on / off | [A] |
| `min_cluster_size` | 3, 4 | **[M]** (manuscript: 5) |
| match against a cluster's nearest members instead of its centroid | on / off | **[M]** (manuscript: centroid) |

**Matching is evaluated with the embedding tier only.** That is what the live
backend path runs (it stores no wording profile), and it avoids choosing a
setting that only works where the wording tiers exist.

**Objective — one number for both weak spots:**
*scams recognised* = share of **all** scams that are in a campaign **and** are
matched back to it
= (1 − unassigned scams) × Scam own-campaign match rate.
Round 1's value, measured the same way, is the baseline.

**A candidate is only eligible if all hold** (Scam thresholds chosen per
candidate by round 1's rule, pooled over seeds 0–4):
1. Scam wrong-campaign ≤ 2%, Scam strangers ≤ 2.8%;
2. Spam own-campaign ≥ round 1's Spam value − 5 points, Spam wrong ≤ 2%,
   Spam strangers ≤ 2.8% (fixing scams may not break spam);
3. largest scam cluster ≤ 15% of clustered scams (no new blob);
4. scam-cluster wording agreement ≥ 90% of round 1's (clusters stay coherent).

**Pick:** the eligible **[A]** candidate with the highest *scams recognised*.
Ties → fewer, simpler changes. **[M]** candidates are reported next to it.

## 3. Confirmation (once)

The winner and round 1's setting are each run **once** on the full population,
with matching measured only on confirmation-set messages (queries and
strangers); centroids are built from non-confirmation members. The thresholds
chosen in exploration are used unchanged. The winner is adopted only if it
still beats round 1 there and still meets rules 1–3. Whatever the outcome,
both numbers are reported.

---

## Results (added after the runs, 2026-09-28)

Search order used: transform → reduction → HDBSCAN settings → per-cluster
bar → transform again → [M] options (each stage keeps the best eligible [A]
setting so far). Epsilon > 0 ran through the standalone `hdbscan` package
(installed in a scratch folder only — the project environment is unchanged);
values are 0.5 / 1 / 2 × the median nearest-neighbour distance.

**Exploration (80%), scams recognised** (embedding tier only):

| Setting | Unassigned scams | Scam own / wrong | Recognised | Eligible |
|---|---|---|---|---|
| round 1 (k=2, fit on Spam+Scam) | 72.8% | 48.1% / 1.9% | 13.1% | baseline |
| **k=8, fit on Scam only** | 61.5% | 61.4% / 0.2% | **23.6%** | **yes — winner** |
| k=6, fit on Scam only | 65.2% | 71.4% / 0.2% | 24.9% | no — largest scam cluster 15.1% |
| PCA 50 dims | 51.9% | 58.6% / 1.5% | 28.2% | no — spam −>5 pts |
| UMAP 10/25/50 dims | 23–28% | 17–28% | 12–22% | no — spam −>5 pts |
| HDBSCAN leaf / epsilon / min_samples 1 | 61–74% | | ≤ 24.5% | no gain |
| per-cluster bar | | | — | no threshold meets the limits |
| **[M]** nearest-member matching | 61.5% | 74.7% / 0.0% | 28.8% | (deviation) |
| **[M]** min_cluster_size 3 + nearest-member | 49.3% | 71.5% / 0.1% | 36.3% | (deviation) |

**Confirmation (locked 20%, run once):**

| | Unassigned (conf. scams) | Scam own / wrong / strangers | Spam own | Largest scam cluster | Recognised |
|---|---|---|---|---|---|
| round 1 | 78.6% | 53.5% / **4.2%** / 1.1% (n=71) | 76.2% | 12.8% | 11.5% |
| winner | 64.8% | 63.2% / 0.9% / 2.3% (n=117) | **70.4%** | **15.4%** | **22.3%** |

**Verdict by the rule: the winner is NOT adopted.** It doubles scams
recognised on data it never saw, but fails two eligibility rules there, both
narrowly: Spam matching drops 5.8 points (limit 5) and the largest scam
cluster is 15.4% (limit 15%). Also found: round 1's own Scam setting, with the
embedding tier only, gave **4.2% wrong** on the confirmation set (3 of 71) —
over the 2% limit, consistent with the 2.1% seen in round 1's pooled data.
