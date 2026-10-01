"""Install a hash-pinned model ZIP for the shared development service.

The command never overwrites an existing model or approval record. It rejects
ZIP path traversal, links, encrypted members, duplicate names, unexpected
archive expansion, an ambiguous model root, and any archive whose SHA-256 does
not match the operator-supplied value. The generated approval manifest has
``development`` scope; it cannot authorize production.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retraining.checksum import hash_bundle, sha256_file
from retraining.version_file import read_version, verify_version
from service.campaign_space import CampaignSpace
from service.model_bundle import inspect_model_bundle

MAX_ARCHIVE_FILES = 256
MAX_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024
MAX_MEMBER_BYTES = 2 * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 1_000


class InstallError(ValueError):
    """The release archive is unsafe, ambiguous, or does not match its pin."""


def _safe_members(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    members = archive.infolist()
    if not members or len(members) > MAX_ARCHIVE_FILES:
        raise InstallError("archive_file_count_invalid")

    seen: set[str] = set()
    total = 0
    for member in members:
        raw_name = member.filename
        name = PurePosixPath(raw_name)
        canonical = name.as_posix()
        if (
            not raw_name
            or "\\" in raw_name
            or name.is_absolute()
            or any(part in {"", ".", ".."} for part in name.parts)
            or canonical != raw_name.rstrip("/")
        ):
            raise InstallError("archive_member_path_invalid")
        identity = canonical.casefold()
        if identity in seen:
            raise InstallError("archive_member_duplicate")
        seen.add(identity)
        unix_mode = member.external_attr >> 16
        if stat.S_ISLNK(unix_mode):
            raise InstallError("archive_links_not_allowed")
        if member.flag_bits & 0x1:
            raise InstallError("archive_encryption_not_allowed")
        if member.file_size > MAX_MEMBER_BYTES:
            raise InstallError("archive_member_too_large")
        if member.file_size and member.compress_size == 0:
            raise InstallError("archive_compression_invalid")
        if member.compress_size and member.file_size / member.compress_size > MAX_COMPRESSION_RATIO:
            raise InstallError("archive_compression_ratio_invalid")
        total += member.file_size
        if total > MAX_UNCOMPRESSED_BYTES:
            raise InstallError("archive_uncompressed_size_too_large")
    return members


def _candidate_root(extracted: Path) -> Path:
    candidates: list[Path] = []
    for config in extracted.rglob("config.json"):
        root = config.parent
        if inspect_model_bundle(root).is_complete:
            candidates.append(root)
    unique = sorted(set(candidates), key=lambda path: path.as_posix())
    if len(unique) != 1:
        raise InstallError("archive_model_root_ambiguous")
    candidate = unique[0]
    if (candidate / "model.safetensors").is_file() is False:
        raise InstallError("development_requires_safetensors")
    return candidate


def install(
    archive_path: Path,
    destination: Path,
    approval_path: Path,
    expected_archive_sha256: str,
    expected_version_tag: str,
    approval_reference: str,
    campaign_space_path: Path | None = None,
) -> dict:
    """Verify and install one development bundle, returning its manifest."""
    expected_digest = expected_archive_sha256.strip().lower()
    if len(expected_digest) != 64 or any(c not in "0123456789abcdef" for c in expected_digest):
        raise InstallError("archive_sha256_invalid")
    if sha256_file(str(archive_path)).lower() != expected_digest:
        raise InstallError("archive_sha256_mismatch")
    if not expected_version_tag.strip():
        raise InstallError("version_tag_required")
    if not approval_reference.strip():
        raise InstallError("approval_reference_required")
    if destination.exists() or approval_path.exists():
        raise InstallError("destination_or_approval_already_exists")
    try:
        if approval_path.resolve().is_relative_to(destination.resolve()):
            raise InstallError("approval_manifest_must_be_external")
    except OSError as exc:
        raise InstallError(f"output_path_invalid: {exc}") from exc

    destination.parent.mkdir(parents=True, exist_ok=True)
    approval_path.parent.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="bantai-model-install-", dir=destination.parent))
    staged_model = scratch / "model"
    staged_approval = scratch / "approval.json"
    installed = False
    try:
        extract_root = scratch / "archive"
        extract_root.mkdir()
        try:
            with zipfile.ZipFile(archive_path) as archive:
                members = _safe_members(archive)
                for member in members:
                    archive.extract(member, extract_root)
                if archive.testzip() is not None:
                    raise InstallError("archive_crc_mismatch")
        except zipfile.BadZipFile as exc:
            raise InstallError("archive_invalid") from exc

        candidate = _candidate_root(extract_root)
        shutil.copytree(candidate, staged_model)

        if campaign_space_path is not None:
            if not campaign_space_path.is_file() or campaign_space_path.is_symlink():
                raise InstallError("campaign_space_invalid")
            try:
                space = CampaignSpace.load(str(campaign_space_path))
            except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
                raise InstallError("campaign_space_invalid") from exc
            if space.model_version != expected_version_tag:
                raise InstallError("campaign_space_model_version_mismatch")
            bundled_space = staged_model / "campaign_space.json"
            if bundled_space.exists() and sha256_file(str(bundled_space)) != sha256_file(str(campaign_space_path)):
                raise InstallError("campaign_space_conflicts_with_archive")
            if not bundled_space.exists():
                shutil.copy2(campaign_space_path, bundled_space)

        actual_version = read_version(str(staged_model))
        if actual_version != expected_version_tag:
            raise InstallError("archive_version_mismatch")
        artifacts = hash_bundle(str(staged_model))
        manifest = {
            "schema_version": 1,
            "approved": True,
            "scope": "development",
            "approval_reference": approval_reference.strip(),
            "version_tag": actual_version,
            "source": {
                "archive_name": archive_path.name,
                "archive_sha256": expected_digest,
            },
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "artifacts": artifacts,
        }
        staged_approval.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        os.replace(staged_model, destination)
        installed = True
        try:
            os.replace(staged_approval, approval_path)
        except OSError:
            # A bundle without its external approval remains fail-closed, but
            # remove it so the same command can be retried cleanly.
            shutil.rmtree(destination)
            installed = False
            raise
        return manifest
    finally:
        if installed:
            shutil.rmtree(scratch, ignore_errors=True)
        elif scratch.exists():
            shutil.rmtree(scratch, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archive", type=Path, nargs="?")
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--expected-version-file", type=Path)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--approval", required=True, type=Path)
    parser.add_argument("--archive-sha256")
    parser.add_argument("--version-tag", required=True)
    parser.add_argument("--approval-reference", required=True)
    parser.add_argument("--campaign-space", type=Path)
    args = parser.parse_args()
    try:
        if args.source_dir:
            if args.archive or args.archive_sha256 or not args.expected_version_file:
                parser.error("component mode requires --expected-version-file and no archive")
            manifest = install_components(
                args.source_dir,
                args.expected_version_file,
                args.destination,
                args.approval,
                args.version_tag,
                args.approval_reference,
                args.campaign_space,
            )
        else:
            if not args.archive or not args.archive_sha256:
                parser.error("archive mode requires archive and --archive-sha256")
            manifest = install(
                args.archive,
                args.destination,
                args.approval,
                args.archive_sha256,
                args.version_tag,
                args.approval_reference,
                args.campaign_space,
            )
    except (InstallError, OSError) as exc:
        parser.exit(2, f"error: {exc}\n")
    print(f"Installed {manifest['version_tag']} for development; verified {len(manifest['artifacts'])} artifacts.")
    return 0


def install_components(
    source_dir: Path,
    expected_version_file: Path,
    destination: Path,
    approval_path: Path,
    expected_version_tag: str,
    approval_reference: str,
    campaign_space_path: Path | None = None,
) -> dict:
    """Build a development runtime from externally hash-pinned components.

    This deliberately records that the source archive was not verified. It
    installs only runtime files, using an independently retrieved version
    record rather than the source directory's potentially different identity.
    It cannot create production approval or independent evaluation evidence.
    """
    runtime_files = {"config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json"}
    if not approval_reference.strip():
        raise InstallError("approval_reference_required")
    if destination.exists() or approval_path.exists():
        raise InstallError("destination_or_approval_already_exists")
    if approval_path.resolve().is_relative_to(destination.resolve()):
        raise InstallError("approval_manifest_must_be_external")
    if source_dir.is_symlink() or expected_version_file.is_symlink():
        raise InstallError("component_links_not_allowed")
    payload = json.loads(expected_version_file.read_text(encoding="utf-8"))
    expected = payload.get("artifacts", {})
    if set(expected) != runtime_files or payload.get("version_tag") != expected_version_tag:
        raise InstallError("component_version_record_invalid")
    for name in sorted(runtime_files):
        file = source_dir / name
        if not file.is_file() or file.is_symlink():
            raise InstallError("component_missing_or_linked")
        if sha256_file(str(file)) != expected[name]:
            raise InstallError("component_digest_mismatch")
    destination.parent.mkdir(parents=True, exist_ok=True)
    approval_path.parent.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="bantai-component-install-", dir=destination.parent))
    staged = scratch / "model"
    staged.mkdir()
    try:
        for name in sorted(runtime_files):
            shutil.copy2(source_dir / name, staged / name)
        shutil.copy2(expected_version_file, staged / "version.json")
        if campaign_space_path:
            if campaign_space_path.is_symlink():
                raise InstallError("component_links_not_allowed")
            space = CampaignSpace.load(str(campaign_space_path))
            if space.model_version != expected_version_tag:
                raise InstallError("campaign_space_model_version_mismatch")
            shutil.copy2(campaign_space_path, staged / "campaign_space.json")
        if not inspect_model_bundle(staged).is_complete or verify_version(str(staged)).status != "ok":
            raise InstallError("component_bundle_integrity_invalid")
        manifest = {
            "schema_version": 1,
            "approved": True,
            "scope": "development",
            "approval_reference": approval_reference.strip(),
            "version_tag": expected_version_tag,
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "source": {
                "kind": "verified_component_reconstruction",
                "archive_status": "not_verified",
                "version_record_sha256": sha256_file(str(expected_version_file)),
            },
            "artifacts": hash_bundle(str(staged)),
        }
        # Rehash copied files before publishing, closing a source-change race.
        for name in sorted(runtime_files):
            if manifest["artifacts"][name] != expected[name]:
                raise InstallError("component_digest_mismatch")
        os.rename(staged, destination)
        try:
            with approval_path.open("x", encoding="utf-8") as handle:
                json.dump(manifest, handle, indent=2, sort_keys=True)
                handle.write("\n")
        except OSError:
            shutil.rmtree(destination)
            raise
        return manifest
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
