import json

from service.model_bundle import inspect_model_bundle


def _bundle(tmp_path, *, labels=None):
    labels = labels or {"0": "Ham", "1": "Spam", "2": "Scam"}
    (tmp_path / "config.json").write_text(json.dumps({"id2label": labels}), encoding="utf-8")
    (tmp_path / "model.safetensors").write_bytes(b"not-loaded-in-this-test")
    (tmp_path / "sentencepiece.bpe.model").write_bytes(b"not-loaded-in-this-test")
    return tmp_path


def test_complete_bundle_passes_structural_check(tmp_path):
    report = inspect_model_bundle(_bundle(tmp_path))

    assert report.is_complete
    assert report.weight_file == "model.safetensors"
    assert report.tokenizer_file == "sentencepiece.bpe.model"


def test_missing_directory_is_reported_without_attempting_a_model_load(tmp_path):
    report = inspect_model_bundle(tmp_path / "missing")

    assert not report.is_complete
    assert report.errors == ("model directory does not exist",)


def test_wrong_label_contract_is_rejected(tmp_path):
    report = inspect_model_bundle(_bundle(tmp_path, labels={"0": "Safe", "1": "Spam", "2": "Scam"}))

    assert not report.is_complete
    assert "Ham, Spam, and Scam" in report.errors[0]


def test_missing_weight_or_tokenizer_is_reported(tmp_path):
    (tmp_path / "config.json").write_text(
        json.dumps({"id2label": {"0": "Ham", "1": "Spam", "2": "Scam"}}), encoding="utf-8"
    )

    report = inspect_model_bundle(tmp_path)

    assert not report.is_complete
    assert "missing model.safetensors or pytorch_model.bin" in report.errors
    assert "missing tokenizer.json, sentencepiece.bpe.model, or spiece.model" in report.errors
