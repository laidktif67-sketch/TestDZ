"""CLI regression tests for the HTML design-token validator.

The validator is intentionally read-only. Keep the CLI honest: it must not
advertise an auto-fix mode unless a real, tested implementation is added.
"""

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "html-token-validator.py"


def _run(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *map(str, args)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def test_help_does_not_advertise_unsupported_fix_option():
    result = _run("--help")

    assert result.returncode == 0
    assert "--fix" not in result.stdout


def test_unsupported_fix_option_is_rejected_without_modifying_file(tmp_path):
    sample = tmp_path / "sample.html"
    original = (
        '<link rel="stylesheet" href="assets/design-tokens.css">\\n'
        '<style>.x { color: #FF0000; }</style>\\n'
    )
    sample.write_text(original, encoding="utf-8")

    result = _run("--fix", sample)

    assert result.returncode == 2
    assert "unrecognized arguments: --fix" in result.stderr
    assert sample.read_text(encoding="utf-8") == original


def test_validator_still_accepts_token_based_html(tmp_path):
    sample = tmp_path / "sample.html"
    sample.write_text(
        '<link rel="stylesheet" href="assets/design-tokens.css">\\n'
        '<style>.x { color: var(--color-primary); background: '
        'var(--color-surface); border-color: var(--color-border); '
        'font-family: var(--typography-font-body); box-shadow: '
        'var(--card-shadow); }</style>\\n',
        encoding="utf-8",
    )

    result = _run(sample)

    assert result.returncode == 0, result.stdout + result.stderr
    assert "ALL PASSED" in result.stdout
