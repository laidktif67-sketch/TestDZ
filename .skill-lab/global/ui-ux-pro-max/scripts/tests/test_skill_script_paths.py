"""Verify that documented commands resolve inside this standalone skill package.

OpenCode supplies the skill's base directory when loading a directory-based
SKILL.md. Commands in this skill therefore use scripts/<file> paths, independent
of the repository root or the directory from which the agent started.
"""

import re
import unittest
from pathlib import Path

SKILL_DIR = next(
    (
        parent for parent in Path(__file__).resolve().parents
        if (parent / "SKILL.md").is_file()
        and (parent / "scripts").is_dir()
        and (parent / "data").is_dir()
    ),
    None,
)
if SKILL_DIR is None:
    raise RuntimeError("Could not locate the standalone ui-ux-pro-max skill directory")

INVOCATION = re.compile(
    r"""(?<![\w/.-])(?:python3?|node|bash)\s+"?([^\s\x60']+\.(?:py|cjs|js|mjs|sh))"""
)


class SkillScriptPathsTest(unittest.TestCase):
    def test_every_documented_script_invocation_resolves_from_skill_directory(self):
        problems, seen = [], 0
        for markdown in sorted(SKILL_DIR.rglob("*.md")):
            for lineno, line in enumerate(markdown.read_text(encoding="utf-8").splitlines(), 1):
                for match in INVOCATION.finditer(line):
                    seen += 1
                    path = match.group(1)
                    if not path.startswith("scripts/"):
                        problems.append(
                            f"{markdown.relative_to(SKILL_DIR)}:{lineno}: "
                            f"{path} -- expected a skill-relative scripts/<file> path"
                        )
                        continue
                    target = (SKILL_DIR / path).resolve()
                    try:
                        target.relative_to(SKILL_DIR.resolve())
                    except ValueError:
                        problems.append(
                            f"{markdown.relative_to(SKILL_DIR)}:{lineno}: "
                            f"{path} -- target escapes the skill directory"
                        )
                        continue
                    if not target.is_file():
                        problems.append(
                            f"{markdown.relative_to(SKILL_DIR)}:{lineno}: "
                            f"{path} -- target does not exist"
                        )
        self.assertGreater(seen, 0, "No documented script invocations were discovered")
        self.assertEqual(problems, [], "\n" + "\n".join(problems))


if __name__ == "__main__":
    unittest.main()
