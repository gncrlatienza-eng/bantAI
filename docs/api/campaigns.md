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
| **What** | cosine match vs. active centroids | HDBSCAN over the buffer |
| **Threshold** | similarity ≥ `0.85` | `min_cluster_size = 5` |
| **Cost** | microseconds (dot products) | seconds–minutes |
| **Code** | `ai/service/campaign.py` | `ai/scripts/cluster_campaigns.py` |
| **Purpose** | join a *known* campaign | discover a *new* campaign |

### Fast path — per message

```
SMS ─▶ mask ─▶ XLM-RoBERTa ─┬─▶ softmax ─▶ label + bucket   (Stage 5a)
                            └─▶ [CLS] 768d ─▶ cosine vs. centroids (Stage 5b)
                                              │
                                    ≥0.85 ────┴──── <0.85
                                      │              │
                              attach to cluster   buffer for
                                                  re-clustering
```

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
    "similarity": 0.913,
    "matched": true,
    "should_buffer": false
  }
}
```

| Field | Meaning |
|---|---|
| `cluster_id` | Matched `CampaignCluster` id, or `null` when nothing cleared 0.85 |
| `similarity` | Cosine similarity to the closest active centroid |
| `matched` | Whether `similarity ≥ 0.85` |
| `should_buffer` | `true` when unmatched — hold for the next HDBSCAN pass |

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
cosine similarity, with only **0.8%** above the 0.85 threshold. The bug was
matching against the wrong population, not a badly chosen threshold.

---

## Centroid refresh

The AI service holds centroids in memory (`routers/classify.py:matcher`). They
are replaced wholesale after each offline re-clustering pass via
`CampaignMatcher.replace_centroids()`. Because a centroid is only meaningful in
the embedding space that produced it, this refresh **must** also happen after
any model retrain.

---

## Retraining invalidates clusters

⚠️ Retraining XLM-RoBERTa changes how embeddings are computed. Centroids
produced by the old checkpoint are not comparable to embeddings from the new
one — similarity scores become meaningless, not merely shifted.

**After every retrain:**

```bash
cd ai
python scripts/embed_dataset.py       # re-embed with the new checkpoint
python scripts/cluster_campaigns.py   # rebuild clusters + centroids
```

`embeddings.npz` records the `model_dir` it was built from so a stale cache is
detectable. Note that re-clustering alone is cheap and safe to repeat any time
— it is pure math over cached embeddings and touches neither the model nor its
accuracy.
