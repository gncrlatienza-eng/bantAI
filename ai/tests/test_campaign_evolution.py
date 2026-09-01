"""Unit tests for campaign evolution tracking (WBS 4.3.8).

Exercises ``detect_evolution`` directly against synthetic two-snapshot pairs
-- no database, no real clustering run needed. Mirrors the conventions of
``test_campaign.py`` (the module this reuses ``cosine_similarity`` from).
"""

import numpy as np
import pytest

from campaign_evolution import (
    DEFAULT_SURGE_RATIO,
    detect_evolution,
)


def unit(*values) -> list:
    """A unit-length vector, matching what service.embeddings produces."""
    v = np.array(values, dtype="float32")
    return list(v / np.linalg.norm(v))


def near_unit(similarity: float) -> list:
    """Unit vector at exactly ``similarity`` cosine from ``unit(1, 0, 0)``.

    These tests need centroids that are "the same campaign, one snapshot
    later". They used to hard-code ``unit(0.99, 0.14, 0)`` (~0.99), which was
    comfortably above the manuscript's 0.85 continuity bar. Sprint 5 (WBS
    5.3.6) re-calibrated that bar to 0.999 after measuring that 0.85 attached
    54.5% of unrelated messages, so 0.99 now reads as *different* campaigns and
    the fixtures have to be tightened to keep testing what they intend.
    """
    return [similarity, float(np.sqrt(max(0.0, 1.0 - similarity**2))), 0.0]


def cluster(cluster_id, size, centroid, domains=None) -> dict:
    """Build a ``campaign_clusters.json``-shaped cluster entry."""
    return {
        "cluster_id": cluster_id,
        "size": size,
        "centroid": centroid,
        "top_domains": domains or [],
    }


# --- new / dissolved ---------------------------------------------------------
def test_first_ever_run_reports_everything_as_new():
    """No previous snapshot means nothing has 'evolved' -- it's all new."""
    current = [cluster(1, 10, unit(1, 0, 0))]
    report = detect_evolution([], current)
    assert report.new_campaigns == ["1"]
    assert report.dissolved_campaigns == []
    assert report.continuing == []


def test_cluster_with_no_current_match_is_dissolved():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    current = [cluster(2, 10, unit(0, 1, 0))]  # orthogonal, no match
    report = detect_evolution(previous, current)
    assert report.dissolved_campaigns == ["1"]
    assert report.new_campaigns == ["2"]
    assert report.continuing == []


def test_below_threshold_similarity_does_not_count_as_continuing():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    # ~0.6 similarity -- well short of the 0.999 default (WBS 5.3.6).
    current = [cluster(2, 10, unit(0.6, 0.8, 0.0))]
    report = detect_evolution(previous, current)
    assert report.continuing == []
    assert report.dissolved_campaigns == ["1"]
    assert report.new_campaigns == ["2"]


def test_empty_current_dissolves_everything():
    previous = [cluster(1, 10, unit(1, 0, 0)), cluster(2, 8, unit(0, 1, 0))]
    report = detect_evolution(previous, [])
    assert sorted(report.dissolved_campaigns) == ["1", "2"]
    assert report.new_campaigns == []


# --- continuing campaigns -----------------------------------------------------
def test_matching_centroid_is_a_continuing_campaign():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    current = [cluster(2, 15, near_unit(0.9995))]
    report = detect_evolution(previous, current)
    assert len(report.continuing) == 1
    c = report.continuing[0]
    assert c.previous_id == "1"
    assert c.current_id == "2"
    assert c.size_before == 10
    assert c.size_after == 15
    assert c.centroid_similarity == pytest.approx(0.9995, abs=1e-4)


def test_growth_ratio_is_after_over_before():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    current = [cluster(1, 25, unit(1, 0, 0))]
    report = detect_evolution(previous, current)
    assert report.continuing[0].growth_ratio == pytest.approx(2.5)


def test_growth_ratio_is_none_when_started_at_zero():
    """Defensive -- real clusters never start at size 0, but the property
    must not divide by zero if handed a malformed snapshot."""
    previous = [cluster(1, 0, unit(1, 0, 0))]
    current = [cluster(1, 5, unit(1, 0, 0))]
    report = detect_evolution(previous, current)
    assert report.continuing[0].growth_ratio is None
    assert not report.continuing[0].is_surging()


# --- population-normalized growth ---------------------------------------------
def test_dataset_growth_alone_does_not_count_as_surging():
    """The regression this guards: cluster_campaigns.py re-clusters the whole
    population every run, so a bigger dataset inflates every cluster's raw
    size at once. Judged on raw counts, a routine dataset top-up would flag
    every campaign as surging."""
    previous = [cluster(1, 100, unit(1, 0, 0))]
    current = [cluster(1, 300, unit(1, 0, 0))]
    # Population tripled too -- this campaign's share of traffic is unchanged.
    report = detect_evolution(previous, current, previous_population=1000, current_population=3000)
    c = report.continuing[0]
    assert c.growth_ratio == pytest.approx(3.0)  # raw growth is real...
    assert c.share_growth_ratio == pytest.approx(1.0)  # ...but share is flat
    assert not c.is_surging()


def test_share_growth_detects_a_real_surge():
    previous = [cluster(1, 100, unit(1, 0, 0))]
    current = [cluster(1, 400, unit(1, 0, 0))]
    # Population only doubled, so this campaign genuinely took over more traffic.
    report = detect_evolution(previous, current, previous_population=1000, current_population=2000)
    c = report.continuing[0]
    assert c.share_growth_ratio == pytest.approx(2.0)
    assert c.is_surging()


def test_shrinking_share_is_not_surging_even_when_count_grows():
    previous = [cluster(1, 100, unit(1, 0, 0))]
    current = [cluster(1, 150, unit(1, 0, 0))]
    report = detect_evolution(previous, current, previous_population=1000, current_population=5000)
    c = report.continuing[0]
    assert c.growth_ratio == pytest.approx(1.5)
    assert c.share_growth_ratio < 1.0
    assert not c.is_surging()


def test_falls_back_to_raw_growth_without_populations():
    """Less trustworthy, but better than refusing to report anything -- the
    caller may genuinely not know the population sizes."""
    previous = [cluster(1, 10, unit(1, 0, 0))]
    current = [cluster(1, 30, unit(1, 0, 0))]
    report = detect_evolution(previous, current)
    c = report.continuing[0]
    assert c.share_growth_ratio is None
    assert c.is_surging()


def test_zero_population_does_not_divide_by_zero():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    current = [cluster(1, 20, unit(1, 0, 0))]
    report = detect_evolution(previous, current, previous_population=0, current_population=0)
    c = report.continuing[0]
    assert c.share_before is None
    assert c.share_growth_ratio is None


def test_surging_flag_uses_default_ratio():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    grew_2x = cluster(1, 20, unit(1, 0, 0))
    grew_slightly = cluster(1, 12, unit(1, 0, 0))

    surging = detect_evolution(previous, [grew_2x]).continuing[0]
    steady = detect_evolution(previous, [grew_slightly]).continuing[0]

    assert surging.is_surging()
    assert not steady.is_surging()


def test_surging_report_helper_filters_correctly():
    previous = [
        cluster(1, 10, unit(1, 0, 0)),
        cluster(2, 10, unit(0, 1, 0)),
    ]
    current = [
        cluster(1, 30, unit(1, 0, 0)),  # surging (3x)
        cluster(2, 11, unit(0, 1, 0)),  # steady
    ]
    report = detect_evolution(previous, current)
    surging_ids = [c.current_id for c in report.surging()]
    assert surging_ids == ["1"]


def test_custom_surge_ratio_is_respected():
    previous = [cluster(1, 10, unit(1, 0, 0))]
    current = [cluster(1, 13, unit(1, 0, 0))]  # 1.3x growth
    report = detect_evolution(previous, current)
    c = report.continuing[0]
    assert not c.is_surging()  # below default 2.0x
    assert c.is_surging(ratio=1.2)  # but above a looser bar


# --- new domains ---------------------------------------------------------------
def test_new_domains_are_the_set_difference():
    previous = [cluster(1, 10, unit(1, 0, 0), domains=["gcash-scam.net"])]
    current = [
        cluster(
            1,
            12,
            unit(1, 0, 0),
            domains=["gcash-scam.net", "gcash-scam2.net", "bpi-verify.ph"],
        )
    ]
    report = detect_evolution(previous, current)
    assert sorted(report.continuing[0].new_domains) == ["bpi-verify.ph", "gcash-scam2.net"]


def test_no_new_domains_yields_empty_list():
    previous = [cluster(1, 10, unit(1, 0, 0), domains=["a.com"])]
    current = [cluster(1, 12, unit(1, 0, 0), domains=["a.com"])]
    report = detect_evolution(previous, current)
    assert report.continuing[0].new_domains == []


# --- merges --------------------------------------------------------------------
def test_two_previous_campaigns_matching_one_current_cluster_is_a_merge():
    previous = [
        cluster(1, 6, unit(1, 0, 0)),
        cluster(2, 9, near_unit(0.9995)),  # also matches the same current
    ]
    current = [cluster(3, 20, unit(1, 0, 0))]
    report = detect_evolution(previous, current)

    assert report.continuing == []
    assert report.new_campaigns == []
    assert report.dissolved_campaigns == []
    assert len(report.merges) == 1
    merge = report.merges[0]
    assert sorted(merge.previous_ids) == ["1", "2"]
    assert merge.current_id == "3"
    assert merge.size_before_total == 15
    assert merge.size_after == 20


def test_merge_does_not_also_appear_as_dissolved_or_new():
    previous = [cluster(1, 5, unit(1, 0, 0)), cluster(2, 5, unit(1, 0, 0))]
    current = [cluster(3, 10, unit(1, 0, 0))]
    report = detect_evolution(previous, current)
    assert report.dissolved_campaigns == []
    assert report.new_campaigns == []


# --- splits ---------------------------------------------------------------------
def test_one_campaign_fragmenting_is_a_split_not_two_new_campaigns():
    """Scam operators rotate templates, so a campaign splitting into variants
    is ordinary. Reporting the variants as brand-new campaigns would make
    new-campaign counts spike every time an existing campaign mutated."""
    previous = [cluster(1, 20, unit(1, 0, 0))]
    current = [
        cluster(5, 12, unit(1, 0, 0)),  # closest fragment
        cluster(6, 9, near_unit(0.9995)),  # variant, still same campaign
    ]
    report = detect_evolution(previous, current)

    assert report.new_campaigns == []
    assert len(report.splits) == 1
    split = report.splits[0]
    assert split.previous_id == "1"
    assert split.primary_id == "5"
    assert split.offshoot_ids == ["6"]
    assert split.size_before == 20
    assert split.size_after_total == 21


def test_split_still_reports_the_primary_fragment_as_continuing():
    """The campaign did continue -- the split event records the fragmentation
    on top of that, rather than replacing it."""
    previous = [cluster(1, 20, unit(1, 0, 0))]
    current = [cluster(5, 12, unit(1, 0, 0)), cluster(6, 9, near_unit(0.9995))]
    report = detect_evolution(previous, current)
    assert [c.current_id for c in report.continuing] == ["5"]


def test_a_genuinely_new_campaign_is_not_reported_as_a_split():
    previous = [cluster(1, 20, unit(1, 0, 0))]
    current = [cluster(5, 12, unit(1, 0, 0)), cluster(6, 9, unit(0, 1, 0))]
    report = detect_evolution(previous, current)
    assert report.new_campaigns == ["6"]
    assert report.splits == []


def test_overlapping_merge_and_split_does_not_crash():
    """Pathological but reachable: two previous campaigns converge on one
    current cluster (a merge) while one of them also has a second fragment
    (a split). Both events are individually true, and split lookup must not
    assume its previous campaign landed in `continuing`."""
    previous = [cluster(1, 10, unit(1, 0, 0)), cluster(2, 8, near_unit(0.9999))]
    current = [cluster(5, 20, unit(1, 0, 0)), cluster(6, 5, near_unit(0.9995))]
    report = detect_evolution(previous, current)
    assert len(report.merges) == 1
    assert len(report.splits) == 1
    assert report.new_campaigns == []


def test_split_offshoots_are_excluded_from_new_campaigns():
    """The two lists must not double-count the same cluster."""
    previous = [cluster(1, 20, unit(1, 0, 0))]
    current = [
        cluster(5, 10, unit(1, 0, 0)),
        cluster(6, 6, near_unit(0.9995)),
        cluster(7, 4, unit(0, 1, 0)),  # actually new
    ]
    report = detect_evolution(previous, current)
    assert report.new_campaigns == ["7"]
    assert report.splits[0].offshoot_ids == ["6"]


# --- merge candidates (single-snapshot, history-independent) ------------------
def test_two_similar_current_clusters_are_flagged_as_merge_candidates():
    current = [
        cluster(1, 10, unit(1, 0, 0)),
        cluster(2, 8, near_unit(0.9995)),  # ~0.99 similarity to cluster 1
    ]
    report = detect_evolution([], current)
    assert len(report.merge_candidates) == 1
    a, b, sim = report.merge_candidates[0]
    assert {a, b} == {"1", "2"}
    assert sim == pytest.approx(0.99, abs=1e-2)


def test_dissimilar_current_clusters_are_not_merge_candidates():
    current = [cluster(1, 10, unit(1, 0, 0)), cluster(2, 8, unit(0, 1, 0))]
    report = detect_evolution([], current)
    assert report.merge_candidates == []


def test_merge_candidates_do_not_duplicate_pairs():
    """Each unordered pair should appear once, not twice (a,b) and (b,a)."""
    current = [
        cluster(1, 10, unit(1, 0, 0)),
        cluster(2, 8, near_unit(0.9995)),
        cluster(3, 6, unit(0.98, 0.20, 0.0)),
    ]
    report = detect_evolution([], current)
    pairs = [{a, b} for a, b, _sim in report.merge_candidates]
    assert len(pairs) == len(set(frozenset(p) for p in pairs))


# --- serialization / misc -------------------------------------------------------
def test_to_dict_is_json_serializable():
    import json

    previous = [cluster(1, 10, unit(1, 0, 0), domains=["a.com"])]
    current = [cluster(2, 20, unit(1, 0, 0), domains=["a.com", "b.com"])]
    report = detect_evolution(previous, current)
    json.dumps(report.to_dict())  # raises if anything isn't serializable


def test_detection_is_deterministic():
    previous = [cluster(1, 10, unit(1, 0, 0)), cluster(2, 6, unit(0, 1, 0))]
    current = [cluster(1, 12, unit(1, 0, 0)), cluster(3, 7, unit(0, 0, 1))]
    a = detect_evolution(previous, current).to_dict()
    b = detect_evolution(previous, current).to_dict()
    assert a == b


def test_default_surge_ratio_is_2x():
    assert DEFAULT_SURGE_RATIO == 2.0
