"""Regression tests for safe brand-to-token synchronization."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent
SCRIPT = SCRIPTS / "sync-brand-to-tokens.cjs"
BRAND_STARTER = SCRIPTS.parent / "templates" / "brand-guidelines-starter.md"
TOKENS_STARTER = SCRIPTS.parent.parent / "design-system" / "templates" / "design-tokens-starter.json"


def make_project(tmp_path):
    (tmp_path / "docs").mkdir()
    (tmp_path / "assets").mkdir()
    shutil.copy(BRAND_STARTER, tmp_path / "docs" / "brand-guidelines.md")
    shutil.copy(TOKENS_STARTER, tmp_path / "assets" / "design-tokens.json")
    return tmp_path / "assets" / "design-tokens.json"


def run_sync(tmp_path, *args):
    node = shutil.which("node")
    if not node:
        pytest.skip("node not available")
    return subprocess.run(
        [node, str(SCRIPT), *args], cwd=tmp_path, capture_output=True, text=True
    )


def test_dry_run_does_not_modify_token_file(tmp_path):
    token_file = make_project(tmp_path)
    before = token_file.read_bytes()
    result = run_sync(tmp_path, "--dry-run")
    assert result.returncode == 0, result.stderr + result.stdout
    assert token_file.read_bytes() == before
    assert "Dry run: no files changed." in result.stdout


def test_sync_uses_documented_color_names_and_preserves_semantic_status(tmp_path):
    token_file = make_project(tmp_path)
    original = json.loads(token_file.read_text())
    original_status = {
        key: original["semantic"]["color"][key]
        for key in ("success", "warning", "error", "info")
        if key in original.get("semantic", {}).get("color", {})
    }
    result = run_sync(tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    tokens = json.loads(token_file.read_text())
    primitive = tokens["primitive"]["color"]
    assert primitive["primary-blue"]["500"]["$value"] == "#2563EB"
    assert primitive["secondary-purple"]["500"]["$value"] == "#8B5CF6"
    assert primitive["accent-green"]["500"]["$value"] == "#10B981"
    for key, value in original_status.items():
        assert tokens["semantic"]["color"][key] == value


def test_missing_required_color_fails_without_changing_files(tmp_path):
    token_file = make_project(tmp_path)
    guide = tmp_path / "docs" / "brand-guidelines.md"
    guide.write_text(guide.read_text().replace("#2563EB", "not-a-color"), encoding="utf-8")
    before = token_file.read_bytes()
    result = run_sync(tmp_path, "--dry-run")
    assert result.returncode != 0
    assert "Missing or invalid required primary color" in result.stderr
    assert token_file.read_bytes() == before


def test_successful_sync_creates_recoverable_backups(tmp_path):
    token_file = make_project(tmp_path)
    css_file = tmp_path / "assets" / "design-tokens.css"
    css_file.write_text("/* existing css */", encoding="utf-8")
    result = run_sync(tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    assert list((tmp_path / "assets").glob("design-tokens.json.backup-*"))
    assert list((tmp_path / "assets").glob("design-tokens.css.backup-*"))
