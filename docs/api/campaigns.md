# Campaign Clustering — Data Flow Spec

**Sprint 3 · WBS 3.2.1 · Track B (AI/ML)**

How a message becomes part of a campaign, who computes what, and who stores it.
Implements the manuscript's Stage 5b (campaign-level branch).

---

## The shared embedding

The manuscript is explicit that classification and clustering are **two
branches off one embedding**, not two pipelines:

> "The final layer [CLS] token vector is pooled as a 768 dimensional sentence
> level semantic representation… This single embedding is reused by Stages 5a
> and 5b." *(manuscript p165)*

So `SmishingClassifier.classify_full()` does a single forward pass with
`output_hidden_states=True` and returns both the class distribution **and** the
768-dim `[CLS]` vector. Computing them separately would double inference cost
and let the two stages drift into different semantic spaces — which would make
"similar" mean different things to the classifier and the clusterer.

Embeddings are L2-normalized on the way out, so cosine similarity reduces to a
dot product.

---

## Two speeds

Campaign intelligence runs on two clocks, per the manuscript:

| | Fast path | Slow path |
|---|---|---|
| **When** | every incoming message | periodically, offline |
| **What** | cosine match vs. active centroids, corroborated by wording | HDBSCAN over the buffer |
| **Threshold** | similarity ≥ `0.998` ⚠️, or a corroborated relaxed bar | `min_cluster_size = 5` |
| **Cost** | microseconds (dot products) | seconds–minutes |
| **Code** | `ai/service/campaign.py` | `ai/scripts/cluster_campaigns.py` |
| **Purpose** | join a *known* campaign | discover a *new* campaign |

⚠️ **The manuscript specifies 0.85 here.** Measured against real data, that
value attaches 54.5% of *unrelated* messages to a campaign — see
`ai/PIPELINE.md` § "Stage 5b — measured limits" for the full recalibration
history (0.85 → 0.999 on 2026-08-26, → 0.998 on 2026-08-30 when the
underlying model was promoted) and the current three-tier matching rule,
detailed below under "`/classify` response addition."

### Fast path — per message

```
SMS ─▶ mask ─▶ XLM-RoBERTa ─┬─▶ softmax ─▶ label + bucket   (Stage 5a)
                            └─▶ [CLS] 768d ─▶ tiered match vs. centroids (Stage 5b)
                                              │
                                  any tier clears ─┴─ nothing clears
                                      │                    │
                              attach to cluster      buffer for
                                                     re-clustering
```

("Any tier clears" = domain match, hybrid match, or the calibrated
embedding-only bar — see the tier table below. Simplified here to the
attach/buffer decision; the full three-tier logic lives in the response
section, not in this diagram.)

### Slow path — offline

Buffered (unmatched) embeddings accumulate. HDBSCAN re-clusters them with
`min_cluster_size = 5`; groups that reach that size become new campaigns, and
everything else stays noise (`-1`) until more like it arrives.

HDBSCAN rather than k-means or DBSCAN because it needs no pre-chosen cluster
count — the manuscript's stated reason — and because it labels genuine one-offs
as noise instead of forcing them into some campaign.

> **Operational constraint (verified 2026-07-30):** HDBSCAN is *density*-based,
> so it finds clusters by contrast against surrounding data. Re-clustering a
> buffer that contains only one campaign's worth of messages and nothing else
> returns all-noise. The buffer must hold a mix of message types. See
> `ai/tests/test_clustering.py::test_single_homogeneous_blob_yields_no_cluster`.

---

## Who owns what

The AI service **has no database access**, and that is deliberate. The backend
already owns campaign persistence (`backend/src/campaigns/`, `CampaignCluster`
in Prisma). If the AI service also wrote to the DB, the dependency would become
circular — backend calls AI `/classify`, AI calls backend `/campaigns` — and
schema knowledge would be duplicated across two stacks.

Instead:

| Responsibility | Owner |
|---|---|
| Compute embedding | AI service |
| Cosine match vs. centroids | AI service |
| Decide "matched / buffer" | AI service |
| Persist `clusterId` on the message | **Backend** |
| Increment `messageCount` | **Backend** |
| Store centroid + `urlDomains` | **Backend** |
| Run offline HDBSCAN | AI service (batch job) |
| Register newly discovered clusters | AI service → `POST /campaigns` |

The per-message decision rides back on the existing `/classify` response, so
the request path stays one-directional.

---

## `/classify` response addition

`POST /classify` (AI service) gains an optional `campaign` object:

```json
{
  "label": "Scam",
  "score": 0.96,
  "scores": { "Ham": 0.01, "Spam": 0.03, "Scam": 0.96 },
  "bucket": "blocked",
  "masked_text": "You have <AMOUNT> waiting. Claim at <URL>",
  "campaign": {
    "cluster_id": "7",
    "similarity": 0.9991,
    "matched": true,
    "should_buffer": false,
    "lexical_similarity": 0.0,
    "match_reason": "embedding"
  }
}
```

| Field | Meaning |
|---|---|
| `cluster_id` | Matched `CampaignCluster` id, or `null` when nothing cleared any tier |
| `similarity` | Cosine similarity to the closest active centroid |
| `matched` | Whether the message cleared **any** of the three tiers below |
| `should_buffer` | `true` when unmatched — hold for the next HDBSCAN pass |
| `lexical_similarity` | Word-overlap (Dice coefficient) with the matched campaign's template. `0.0` when no lexical profile or nothing matched |
| `match_reason` | Which tier matched — `"domain"` \| `"hybrid"` \| `"embedding"`, or `null` when unmatched |

**Three match tiers**, checked in order of how much evidence each carries —
adviser-approved 2026-08-26 as an addition beyond the manuscript's single
threshold (`ai/PIPELINE.md` § "Adviser sign-off received"):

| `match_reason` | Rule | Rationale |
|---|---|---|
| `domain` | shares a blasted domain **and** cosine ≥ 0.90 | link identity is near-conclusive on its own |
| `hybrid` | cosine ≥ 0.99 **and** `lexical_similarity` ≥ 0.45 | a coarse embedding filter wording then has to confirm |
| `embedding` | cosine ≥ **0.998** | the calibrated bar alone (was 0.999 before the 2026-08-30 model promotion) — no wording needed |

The `embedding` tier is exactly the pre-hybrid, manuscript-shaped rule, so
the other two tiers are strictly additive — they can only add matches that
rule would have missed, never remove ones it caught.

**`campaign` is `null` when no centroids are loaded** (cold start, before any
clustering has run). Existing callers that ignore the field are unaffected —
this is an additive change, not a breaking one.

---

## Ham is not matched against campaigns

`/classify` only performs campaign matching when the predicted label is **not**
`Ham`. Clusters are built from the Spam+Scam population — personal
conversation is not a coordinated blast — so comparing a Ham message against
them is meaningless by construction.

This is not theoretical: verification on 2026-07-30 found the personal message
*"Hi, are we still meeting at 5pm later?"* matching a money-transfer-notification
cluster at 0.96, because both are short and transactional in tone.

The embedding space itself is sound — Ham-vs-Scam pairs average **−0.008**
cosine similarity, with only **0.8%** above the manuscript's original 0.85
bar (measured 2026-07-30, before either recalibration below). The bug was
matching against the wrong population, not a badly chosen threshold — a
conclusion that holds regardless of which specific bar is current, since
Ham and Scam separate by roughly a full point of cosine similarity, not by
a fraction of a percent the way same-class pairs do.

---

## `GET /campaigns/centroids`

Internal route, AI-service-only (not called by mobile or the dashboard).
Returns just the vectors the cosine matcher needs, deliberately narrower than
the general `GET /campaigns` list — a centroid is 768 floats, and fattening
the list every client fetches wasn't worth it for one internal consumer.

```json
[
  { "id": "7", "centroid": [0.0123, -0.0456, "... 768 floats"] }
]
```

Only `isActive` clusters are returned. Consumed by `ai/service/centroid_source.py`
(`load_from_backend`), which is the default centroid source
(`BANTAI_AI_CENTROID_SOURCE=backend`) — see `ai/.env.example`.

---

## Centroid refresh

The AI service holds centroids in memory (`routers/classify.py:matcher`),
loaded **from the backend** at startup (`centroid_source = "backend"`), not
from `campaign_clusters.json`. A new clustering run therefore reaches the live
service only after it is pushed into the backend
(`scripts/sync_campaigns_to_backend.py`) and the AI service is restarted.
Because a centroid is only meaningful in the embedding space that produced it,
this refresh **must** also happen after any model retrain.

---

## Retraining invalidates clusters

⚠️ Retraining XLM-RoBERTa changes how embeddings are computed. Centroids
produced by the old checkpoint are not comparable to embeddings from the new
one — similarity scores become meaningless, not merely shifted.

**After every retrain:**

```bash
cd ai
python scripts/embed_dataset.py                    # re-embed with the new checkpoint
python scripts/cluster_campaigns.py                # rebuild clusters + centroids
python scripts/sync_campaigns_to_backend.py        # dry run: check the plan
python scripts/sync_campaigns_to_backend.py --apply  # push to the backend
# then restart the AI service so it loads them
```

**Don't skip the sync.** The live service reads centroids from the backend, so
the first two steps alone change nothing it uses. That is exactly what
happened after the 2026-08-30 promotion: the clusters were rebuilt locally, but
the backend kept the old model's 221 clusters until 2026-09-12. The sync
creates the new clusters before switching off (not deleting) the old ones, and
waits out the backend's 120-requests-per-minute limit (a full sync takes about
5 minutes).

**Link suppression.** The backend hides any link whose domain belongs to an
active cluster. The sync sends a cluster's domains only if the cluster is
mostly Scam, and never sends official brand domains, link shorteners (the
backend already hides those), or shared platforms like `facebook.com`.
Spam clusters are honest marketing, and copying their domains used to hide
official Globe/GCash links.

`embeddings.npz` records the `model_dir` it was built from so a stale cache is
detectable. Note that re-clustering alone is cheap and safe to repeat any time
— it is pure math over cached embeddings and touches neither the model nor its
accuracy.
