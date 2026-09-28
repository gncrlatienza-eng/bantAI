# Item 19 follow-up — selection rules, written before measuring (2026-09-28)

Written after the first item-19 calibration (`campaign_space_calibration.json`,
space `ad000dee9174`) showed two weak spots, and **before** any of the
measurements below were run. The results are judged only by these rules.

## Weak spot 1 — scam messages match their own campaign only 23% of the time

Cause seen in the first run: one threshold serves Spam and Scam, and it is set
by Spam (nearly every stranger attachment was a Spam message).

**Change:** a separate set of match thresholds for messages the classifier
labels **Scam**. Spam keeps its own set. The same three-tier search as before
is run separately on each label's messages.

**Rule, per label:** maximize held-out members matched to their own campaign,
subject to
- wrong campaign ≤ 2% of that label's held-out members, and
- strangers attached ≤ 2.8% of that label's unclustered messages.

Ties → fewer strangers, then stricter settings.

**Small-sample guard:** only ~86 Scam members are held out per split, so the
held-out split is repeated with **5 seeds (0–4)** and the outcomes are pooled
before choosing. The chosen values are reported with the range across seeds.

## Weak spot 2 — 74% of scams belong to no campaign

`min_cluster_size = 5` is manuscript-specified and **does not change**. Only
HDBSCAN settings the manuscript does not specify are tried:
`min_samples` ∈ {1, 2}, `cluster_selection_method` ∈ {eom, leaf},
`cluster_selection_epsilon` ∈ {0, 0.1, 0.2, 0.3}.

**Rule:** among settings that pass all of
1. largest scam cluster ≤ 15% of clustered scams (the existing sanity limit in
   `cluster_campaigns.py` — no new blob);
2. held-out wrong-campaign ≤ 2% (embedding-only screening, seed 0);
3. scam-cluster wording agreement (median lexical similarity of each scam
   member to its own cluster's profile) ≥ 90% of the current setting's value —
   the new clusters must still be about the same wording;

pick the one with the **fewest unassigned scams**. If none beats the current
setting (min_samples 2, eom, epsilon 0), keep the current setting and report
the limit honestly.

Then weak spot 1's calibration is run on whichever clustering is chosen here.

---

## Result — weak spot 2 (added after the run, 2026-09-28)

| min_samples | method | epsilon | scam clusters | largest scam cluster | scams unassigned | wrong (screen) | wording | passes |
|---|---|---|---|---|---|---|---|---|
| 2 | eom | 0 (current) | 48 | 12.8% | **74.0%** | 0.2% | 0.263 | baseline |
| 2 | leaf | 0 | 51 | 4.8% | 76.2% | 1.1% | 0.300 | yes, but more unassigned |
| 1 | eom | 0 | identical to current | | | | | |
| 1 | leaf | 0 | identical to 2 / leaf | | | | | |
| any | any | 0.1 / 0.2 / 0.3 | **could not be run** | | | | | — |

Every `cluster_selection_epsilon > 0` setting crashes inside scikit-learn
1.9.0 with numpy 2.4.6 (`TypeError: only 0-dimensional arrays can be converted
to Python scalars`, in `_tree.pyx` `epsilon_search`) — a library bug, not a
result. Those 8 settings are **untested**, not rejected.

**Decision by the rule above:** no tested setting has fewer unassigned scams
than the current one, so the clustering stays at min_samples 2 / eom /
epsilon 0. The 74% is reported as a limit of the data (no senders or send
times; most scams occur once after de-duplication), not fixed.

## Result — weak spot 1 (added after the run, 2026-09-28)

`scripts/calibrate_campaign_space.py`, seeds 0–4 pooled
(`campaign_space_calibration.json`):

| Messages | Embedding | Hybrid gate | Domain floor | Own campaign (range over seeds) | Wrong | Strangers |
|---|---|---|---|---|---|---|
| Scam (own set) | 0.9066 | 0.8996 | 0.8351 | **56.6%** (52.3–59.3%) | 1.8% | 1.4% |
| Spam (own set) | 0.9465 | off | 0.9370 | 78.3% (78.1–78.9%) | 0.2% | 2.7% |
| shared fallback | 0.9402 | off | 0.9255 | 75.8% (74.9–76.8%) | 0.3% | 2.6% |

Scam members matched to their own campaign: **23% → 56.6%**, within both
limits. 433 Scam members held out in total across the 5 splits.

Caveats:
- Calibration groups messages by their dataset label; the live service uses
  the classifier's predicted label. They agree for ~96% of scams (Model C
  holdout recall 95.7%).
- **Backend path:** the backend stores no wording profile, so only the
  embedding tier can fire there. Embedding tier alone at Scam's 0.9066:
  53.6% own / **2.1% wrong** / 1.2% strangers. That is just over the 2%
  wrong-campaign limit. It is fixed by giving the backend a wording-profile
  column (already on the backend list), or by calibrating a separate
  embedding-only set.
