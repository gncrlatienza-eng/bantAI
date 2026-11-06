# Item 19, round 3 — separate scam and spam paths, rules written before measuring (2026-09-28)

Round 2's winner (transform fitted on Scam only, k=8) doubled scams
recognised on unseen data (11.5% → 22.3%) but was not adopted: using the
scam-tuned space for Spam too cost Spam matching 5.8 points, and the largest
scam cluster reached 15.4%. Round 3 removes that coupling and searches the
scam path exhaustively.

## Design under test

- **Scam path:** Scam messages are clustered among Scam messages only, in a
  space tuned on Scam messages; a message the classifier labels Scam is
  matched only against scam campaigns, in that space.
- **Spam path:** unchanged from round 1 (k=2 space fitted on Spam+Scam),
  but clustered among Spam messages only.

## Test data

- **Exploration:** the whole clustering population (8,711; round 2's 20%
  confirmation set is spent, so it is no longer held back).
- **Confirmation, run once:** the frozen classifier holdout's 491 Scam and
  958 Spam messages, embedded with Model C (checked: 0 of 3,236 holdout rows
  appear in the clustering data). They are clustered together with the
  population in spaces fitted on the population only; holdout members of a
  cluster are the queries, centroids come from population members only,
  holdout messages left unclustered are the strangers and count as
  unassigned.

## Scam-path candidates (full grid, not staged)

| | Values |
|---|---|
| directions removed `k` (fit on Scam) | 4, 6, 8, 10, 12, 16, 24 |
| reduction (matching runs in the same reduced space) | none; PCA 10, 25, 50, 100; UMAP 10, 25, 50 |
| HDBSCAN `min_samples` / method | 1, 2 / eom, leaf |
| HDBSCAN epsilon (× median nearest-neighbour distance) | 0, 0.5, 1, 2 |

`min_cluster_size` stays 5; matching stays centroid-based (manuscript).
Embedding tier only (what the backend path runs).

**New dependencies must earn their place:** a setting needing UMAP at runtime
(numba — heavy) is eligible only if it beats the best setting without it by
**≥ 5 points** of *scams recognised*; one needing the `hdbscan` package offline
(epsilon > 0) by **≥ 2 points**.

## Objective and rules (as round 2)

*Scams recognised* = (1 − unassigned scams) × Scam own-campaign match rate.
Eligible only if: Scam wrong ≤ 2% and Scam strangers ≤ 2.8% (pooled over
seeds 0–4); Spam path own-campaign ≥ round 1 − 5 points with wrong ≤ 2% and
strangers ≤ 2.8%; largest scam cluster ≤ 15% of clustered scams; scam wording
agreement ≥ 90% of round 1's. Pick the eligible setting with the highest
*scams recognised*; ties → fewer changes.

**Adopt only if**, on the holdout confirmation, it beats round 1 on scams
recognised **and** meets every rule above. Either way, both are reported.

---

## Results (added after the runs, 2026-09-28)

**Exploration** (all 896 settings; run interrupted once by low memory at 608
and resumed — finished settings were kept, none re-run). Winner:
**k=16 fitted on Scam, UMAP 25 dims, min_samples 1, eom, epsilon 0** —
unassigned 14.8%, Scam own/wrong 76.4% / 0.6%, strangers 2.7%, largest scam
cluster 2.8%, wording 0.2373 (floor 0.2369), scams recognised **65.0%**
(round 1: 12.3%). Best without UMAP/epsilon: k=24, no reduction, leaf —
unassigned 52.8%, 72.1% / 0.8%, recognised 34.0%. The UMAP winner cleared
the 5-point dependency margin.

**Confirmation — frozen classifier holdout, run once** (491 Scam, 958 Spam):

| | Scams unassigned | Scam own / wrong / **strangers** | Wording | Largest scam cluster | Scams recognised | Spam own / strangers |
|---|---|---|---|---|---|---|
| round 1 | 62.3% | 41.8% / 0.6% / 1.3% | 0.327 | 13.3% | 15.7% | 73.5% / 3.5% |
| round 3 winner | **24.9%** | 53.0% / 0.6% / **6.6%** | **0.208** | 6.4% | **39.8%** | 75.3% / 4.2% |

**Verdict by the rule: NOT adopted.** On unseen messages it still cuts
unassigned scams from 62% to 25% and recognises 2.5× as many scams, but it
attaches **6.6%** of unrelated scam messages to campaigns (limit 2.8%, 2.3×
over) and its clusters' wording agreement falls to 0.208 (floor 0.237). The
exploration numbers were optimistic — the stranger rate and wording both
passed there by thin margins. The thresholds may not be re-tuned on the
holdout: it is now spent.

Also from the holdout: round 1's own Scam setting is inside every Scam limit
on unseen data (0.6% wrong, 1.3% strangers) — the 4.2% wrong seen on round
2's 71-message confirmation set does not reproduce on 177 queries. Both Spam
paths exceed the 2.8% stranger limit on the holdout (3.5% / 4.2%).
