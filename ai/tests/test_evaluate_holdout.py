"""Unit tests for the holdout confusion-matrix scoring logic (WBS 6.4.6).

Only the pure computation is covered -- ``confusion_matrix`` and
``per_class_metrics`` take label ids in, return numbers out, no model, no
filesystem. The CLI around them (loading a checkpoint, reading the holdout
CSV, writing the JSON) is thin orchestration, same reasoning as
``test_retrain_cli.py`` only covering source resolution.
"""

import importlib.util
import os
import sys

_SPEC = importlib.util.spec_from_file_location(
    "evaluate_holdout",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "evaluate_holdout.py"),
)
eh = importlib.util.module_from_spec(_SPEC)
sys.modules["evaluate_holdout"] = eh
_SPEC.loader.exec_module(eh)

# Label ids: 0=Ham, 1=Spam, 2=Scam (training.config.LABEL2ID)
HAM, SPAM, SCAM = 0, 1, 2


def test_confusion_matrix_diagonal_on_perfect_predictions():
    y_true = [HAM, HAM, SPAM, SCAM]
    matrix = eh.confusion_matrix(y_true, y_true)
    assert matrix["Ham"] == {"Ham": 2, "Spam": 0, "Scam": 0}
    assert matrix["Spam"] == {"Ham": 0, "Spam": 1, "Scam": 0}
    assert matrix["Scam"] == {"Ham": 0, "Spam": 0, "Scam": 1}


def test_confusion_matrix_off_diagonal_counts_mistakes():
    y_true = [SCAM, SCAM, SCAM]
    y_pred = [SCAM, SPAM, HAM]  # one right, one under-called as Spam, one missed entirely
    matrix = eh.confusion_matrix(y_true, y_pred)
    assert matrix["Scam"] == {"Ham": 1, "Spam": 1, "Scam": 1}


def test_per_class_metrics_perfect_predictions_score_1():
    y_true = [HAM, SPAM, SCAM, HAM, SPAM, SCAM]
    matrix = eh.confusion_matrix(y_true, y_true)
    metrics = eh.per_class_metrics(matrix)
    for label in eh.LABELS:
        assert metrics[label]["precision"] == 1.0
        assert metrics[label]["recall"] == 1.0
        assert metrics[label]["f1"] == 1.0
        assert metrics[label]["false_positives"] == 0
        assert metrics[label]["false_negatives"] == 0


def test_per_class_metrics_false_negative_hurts_recall_not_precision():
    """A missed Scam (predicted Ham) should show up as Scam's problem, not Ham's."""
    y_true = [SCAM, SCAM, HAM]
    y_pred = [SCAM, HAM, HAM]  # one Scam correctly caught, one Scam missed as Ham
    matrix = eh.confusion_matrix(y_true, y_pred)
    metrics = eh.per_class_metrics(matrix)

    assert metrics["Scam"]["false_negatives"] == 1
    assert metrics["Scam"]["recall"] == 0.5  # caught 1 of 2 real scams
    assert metrics["Scam"]["precision"] == 1.0  # every Scam call it made was right

    # Ham's false_positives count reflects the wrongly-called-Ham Scam --
    # that's what "false positive for Ham" means (predicted Ham, wasn't).
    assert metrics["Ham"]["false_positives"] == 1


def test_per_class_metrics_support_equals_actual_class_count():
    y_true = [HAM, HAM, HAM, SPAM, SCAM]
    matrix = eh.confusion_matrix(y_true, y_true)
    metrics = eh.per_class_metrics(matrix)
    assert metrics["Ham"]["support"] == 3
    assert metrics["Spam"]["support"] == 1
    assert metrics["Scam"]["support"] == 1


def test_zero_support_class_does_not_divide_by_zero():
    """A holdout slice with no Scam rows at all must not crash the report."""
    y_true = [HAM, HAM, SPAM]
    y_pred = [HAM, SPAM, SPAM]
    matrix = eh.confusion_matrix(y_true, y_pred)
    metrics = eh.per_class_metrics(matrix)
    assert metrics["Scam"]["support"] == 0
    assert metrics["Scam"]["precision"] == 0.0
    assert metrics["Scam"]["recall"] == 0.0
    assert metrics["Scam"]["f1"] == 0.0
