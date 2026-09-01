"""Campaign evolution tracking (Sprint 4, WBS 4.3.8).

Compares two snapshots of the offline HDBSCAN clustering pass
(``scripts/cluster_campaigns.py`` output -- see ``campaign_clusters.json``)
and reports what changed between them: which campaigns are new, which
stopped appearing, which grew, which picked up new domains, which folded
into another campaign, which fragmented into variants, and which pair of
still-distinct campaigns now look similar enough that they probably should
be one.

Cluster ids are not stable identities across runs -- HDBSCAN relabels from
scratch every pass, so "cluster 7 last week" and "cluster 7 this week" are
unrelated integers. Continuity has to be re-derived by matching centroids, so
this module reuses the same cosine-similarity notion of "same campaign" that
``service/campaign.py`` uses at match time (0.999, re-calibrated from the
manuscript's original 0.85 -- see Stage 5b in ``PIPELINE.md``) -- using a
different threshold here to decide continuity than the one used to decide
message membership would make "this is the same campaign" mean two different
things in two places.

Pure module: no database, no HTTP, no file I/O. Callers (the CLI script, or
a future backend job) load two snapshot JSON files and pass their
``clusters`` lists in; this only compares and reports. Same ownership
boundary as ``retraining/`` -- see ``RETRAINING.md`` "Ownership boundary".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from service.campaign import DEFAULT_SIMILARITY_THRESHOLD, cosine_similarity

# A continuing campaign counts as "surging" once it accounts for at least
# this many times the share of traffic it held last snapshot. 2x is a
# deliberately coarse bar -- this flags a cluster for a human to look at,
# not an automated action, so it should fire rarely enough to be worth
# reading.
DEFAULT_SURGE_RATIO = 2.0


@dataclass
class ClusterSnapshotEntry:
    """One cluster as recorded in a ``campaign_clusters.json`` snapshot.

    Field names mirror ``cluster_campaigns.py``'s JSON output (``cluster_id``,
    ``size``, ``top_domains``, ``centroid``), so a snapshot dict can be
    converted with ``ClusterSnapshotEntry.from_dict(entry)`` regardless of
    which extra keys (``labels``, ``sample``, ``unique_senders``, ...) that
    run happened to include.
    """

    cluster_id: str
    size: int
    centroid: Sequence[float]
    top_domains: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "ClusterSnapshotEntry":
        return cls(
            cluster_id=str(data["cluster_id"]),
            size=int(data["size"]),
            centroid=data["centroid"],
            top_domains=list(data.get("top_domains", [])),
        )


def _share(size: int, population: Optional[int]) -> Optional[float]:
    if population is None or population <= 0:
        return None
    return size / population


@dataclass
class ContinuingCampaign:
    """A cluster present in both snapshots, matched 1:1 by centroid similarity."""

    previous_id: str
    current_id: str
    centroid_similarity: float
    size_before: int
    size_after: int
    new_domains: List[str]
    #: Fraction of each snapshot's clustered population this campaign held.
    #: ``None`` when the caller did not supply population sizes.
    share_before: Optional[float] = None
    share_after: Optional[float] = None

    @property
    def growth_ratio(self) -> Optional[float]:
        """Raw ``size_after / size_before``, or ``None`` if it started at zero.

        Reported for transparency, but see ``share_growth_ratio``: raw counts
        are not comparable across snapshots taken over different-sized
        populations.
        """
        if self.size_before == 0:
            return None
        return self.size_after / self.size_before

    @property
    def share_growth_ratio(self) -> Optional[float]:
        """Growth in this campaign's *share* of the clustered population.

        This, not ``growth_ratio``, is what "growing" should mean here.
        ``cluster_campaigns.py`` re-clusters the entire Spam+Scam population
        on every run rather than an incremental buffer, so when the dataset
        itself grows (15,728 -> 16,772 rows already, and it keeps growing)
        every cluster's raw ``size`` grows with it. Judging surges on raw
        counts would flag every campaign at once after any dataset top-up --
        an alert that fires on everything is the same as no alert.
        """
        if self.share_before is None or self.share_after is None:
            return None
        if self.share_before == 0:
            return None
        return self.share_after / self.share_before

    def is_surging(self, ratio: float = DEFAULT_SURGE_RATIO) -> bool:
        """Whether this campaign is taking up a materially bigger slice of
        traffic than it did last snapshot.

        Falls back to raw-count growth when population sizes were not
        supplied -- less trustworthy for the reason above, which is why the
        CLI always passes them.
        """
        growth = self.share_growth_ratio
        if growth is None:
            growth = self.growth_ratio
        return growth is not None and growth >= ratio


@dataclass
class MergeEvent:
    """Two or more previous campaigns that now match the same current cluster.

    Confirmed, not guessed -- each of ``previous_ids`` independently matched
    this ``current_id`` as its closest campaign above threshold, which is
    what "these used to be separate and now aren't" actually means here.
    """

    previous_ids: List[str]
    current_id: str
    size_before_total: int
    size_after: int


@dataclass
class SplitEvent:
    """One previous campaign that now matches several current clusters.

    The dual of ``MergeEvent``, and the reason it matters: scam operators
    rotate templates, so a campaign fragmenting into variants is ordinary
    behaviour here. Without split detection those variants would each be
    reported as a brand-new campaign, which is not merely incomplete -- it is
    the wrong answer, and it would make new-campaign counts spike whenever an
    existing campaign mutated.

    ``primary_id`` is the fragment the previous campaign matched most
    closely (also reported under ``continuing``); ``offshoot_ids`` are the
    additional fragments that would otherwise have looked new.
    """

    previous_id: str
    primary_id: str
    offshoot_ids: List[str]
    size_before: int
    size_after_total: int


@dataclass
class EvolutionReport:
    """What changed between two clustering snapshots."""

    new_campaigns: List[str]
    dissolved_campaigns: List[str]
    continuing: List[ContinuingCampaign]
    merges: List[MergeEvent]
    splits: List[SplitEvent]
    #: Pairs of *current* clusters similar enough to plausibly be the same
    #: campaign, independent of any previous-snapshot history -- see
    #: ``_find_merge_candidates``.
    merge_candidates: List[Tuple[str, str, float]]

    def surging(self, ratio: float = DEFAULT_SURGE_RATIO) -> List[ContinuingCampaign]:
        return [c for c in self.continuing if c.is_surging(ratio)]

    def to_dict(self) -> dict:
        return {
            "new_campaigns": self.new_campaigns,
            "dissolved_campaigns": self.dissolved_campaigns,
            "continuing": [
                {
                    "previous_id": c.previous_id,
                    "current_id": c.current_id,
                    "centroid_similarity": round(c.centroid_similarity, 4),
                    "size_before": c.size_before,
                    "size_after": c.size_after,
                    "growth_ratio": (round(c.growth_ratio, 2) if c.growth_ratio is not None else None),
                    "share_growth_ratio": (
                        round(c.share_growth_ratio, 2) if c.share_growth_ratio is not None else None
                    ),
                    "surging": c.is_surging(),
                    "new_domains": c.new_domains,
                }
                for c in self.continuing
            ],
            "merges": [
                {
                    "previous_ids": m.previous_ids,
                    "current_id": m.current_id,
                    "size_before_total": m.size_before_total,
                    "size_after": m.size_after,
                }
                for m in self.merges
            ],
            "splits": [
                {
                    "previous_id": s.previous_id,
                    "primary_id": s.primary_id,
                    "offshoot_ids": s.offshoot_ids,
                    "size_before": s.size_before,
                    "size_after_total": s.size_after_total,
                }
                for s in self.splits
            ],
            "merge_candidates": [
                {"cluster_a": a, "cluster_b": b, "similarity": round(sim, 4)} for a, b, sim in self.merge_candidates
            ],
        }


def _best_match(
    entry: ClusterSnapshotEntry,
    candidates: Sequence[ClusterSnapshotEntry],
    threshold: float,
) -> Optional[Tuple[ClusterSnapshotEntry, float]]:
    """The candidate closest to ``entry`` by cosine similarity, if it clears
    ``threshold``. Greedy nearest-match rather than an assignment algorithm
    (e.g. Hungarian): campaigns rarely converge onto exactly the same
    centroid, so ambiguous ties are the exception, not the case this needs
    to optimize for."""
    best_entry: Optional[ClusterSnapshotEntry] = None
    best_sim = -2.0
    for candidate in candidates:
        sim = cosine_similarity(entry.centroid, candidate.centroid)
        if sim > best_sim:
            best_sim, best_entry = sim, candidate
    if best_entry is not None and best_sim >= threshold:
        return best_entry, best_sim
    return None


def detect_evolution(
    previous: Sequence[dict],
    current: Sequence[dict],
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    previous_population: Optional[int] = None,
    current_population: Optional[int] = None,
) -> EvolutionReport:
    """Compare two clustering snapshots and report what changed.

    ``previous``/``current`` are the ``clusters`` lists straight out of two
    ``campaign_clusters.json`` runs (or the backend's equivalent). An empty
    ``previous`` (first-ever run) reports everything in ``current`` as new,
    which is correct -- there is nothing for it to have evolved from.

    ``previous_population``/``current_population`` are each snapshot's
    ``n_messages`` (the size of the population that was clustered). Supply
    them whenever they are available: growth is only meaningful relative to
    the population it was measured over -- see
    ``ContinuingCampaign.share_growth_ratio``.
    """
    prev_entries = [ClusterSnapshotEntry.from_dict(e) for e in previous]
    cur_entries = [ClusterSnapshotEntry.from_dict(e) for e in current]
    cur_by_id = {c.cluster_id: c for c in cur_entries}
    prev_by_id = {p.cluster_id: p for p in prev_entries}

    # previous_id -> (matched current entry, similarity)
    prev_matches: Dict[str, Tuple[ClusterSnapshotEntry, float]] = {}
    for prev in prev_entries:
        match = _best_match(prev, cur_entries, threshold)
        if match is not None:
            prev_matches[prev.cluster_id] = match

    # Group previous ids by the current cluster they matched, so a current
    # cluster claimed by more than one previous campaign becomes a merge
    # rather than two separate "continuing" entries.
    claims: Dict[str, List[str]] = {}
    for prev_id, (cur_entry, _sim) in prev_matches.items():
        claims.setdefault(cur_entry.cluster_id, []).append(prev_id)

    continuing: List[ContinuingCampaign] = []
    merges: List[MergeEvent] = []

    for cur_id, prev_ids in claims.items():
        cur_entry = cur_by_id[cur_id]
        if len(prev_ids) == 1:
            prev_id = prev_ids[0]
            prev_entry = prev_by_id[prev_id]
            _match_entry, sim = prev_matches[prev_id]
            new_domains = sorted(set(cur_entry.top_domains) - set(prev_entry.top_domains))
            continuing.append(
                ContinuingCampaign(
                    previous_id=prev_id,
                    current_id=cur_id,
                    centroid_similarity=sim,
                    size_before=prev_entry.size,
                    size_after=cur_entry.size,
                    new_domains=new_domains,
                    share_before=_share(prev_entry.size, previous_population),
                    share_after=_share(cur_entry.size, current_population),
                )
            )
        else:
            merges.append(
                MergeEvent(
                    previous_ids=sorted(prev_ids),
                    current_id=cur_id,
                    size_before_total=sum(prev_by_id[p].size for p in prev_ids),
                    size_after=cur_entry.size,
                )
            )

    dissolved = [p.cluster_id for p in prev_entries if p.cluster_id not in prev_matches]
    unclaimed = [c for c in cur_entries if c.cluster_id not in claims]

    # A cluster nothing claimed may still be an offshoot of a campaign that
    # fragmented: matching runs previous -> current, so a previous campaign
    # only ever claims its single closest fragment, and the rest fall
    # through here looking new. Note this can only ever find an *already
    # matched* previous campaign -- if an unclaimed current matched some
    # previous above threshold, that previous necessarily found a match at
    # least that good of its own, so it cannot be sitting in `dissolved`.
    offshoots: Dict[str, List[str]] = {}
    new_campaigns: List[str] = []
    for cur in unclaimed:
        match = _best_match(cur, prev_entries, threshold)
        if match is None:
            new_campaigns.append(cur.cluster_id)
        else:
            prev_entry, _sim = match
            offshoots.setdefault(prev_entry.cluster_id, []).append(cur.cluster_id)

    splits: List[SplitEvent] = []
    for prev_id, offshoot_ids in offshoots.items():
        primary_entry, _sim = prev_matches[prev_id]
        fragment_ids = [primary_entry.cluster_id] + offshoot_ids
        splits.append(
            SplitEvent(
                previous_id=prev_id,
                primary_id=primary_entry.cluster_id,
                offshoot_ids=sorted(offshoot_ids),
                size_before=prev_by_id[prev_id].size,
                size_after_total=sum(cur_by_id[f].size for f in fragment_ids),
            )
        )

    merge_candidates = _find_merge_candidates(cur_entries, threshold)

    return EvolutionReport(
        new_campaigns=new_campaigns,
        dissolved_campaigns=dissolved,
        continuing=continuing,
        merges=merges,
        splits=splits,
        merge_candidates=merge_candidates,
    )


def _find_merge_candidates(current: Sequence[ClusterSnapshotEntry], threshold: float) -> List[Tuple[str, str, float]]:
    """Pairs of *distinct* current clusters whose centroids are similar
    enough to plausibly be the same campaign, evaluated on one snapshot alone.

    HDBSCAN clusters by density contrast, not by a fixed similarity cutoff,
    so it can (rarely) leave two clusters standing that would both match the
    same centroid at message-match time under the live 0.999 threshold.
    Surfacing this is intentionally
    conservative -- it flags a pair for an admin to review and merge (see the
    dashboard's Campaign Management merge action), never merges automatically.
    """
    candidates: List[Tuple[str, str, float]] = []
    for i in range(len(current)):
        for j in range(i + 1, len(current)):
            sim = cosine_similarity(current[i].centroid, current[j].centroid)
            if sim >= threshold:
                candidates.append((current[i].cluster_id, current[j].cluster_id, sim))
    return candidates
