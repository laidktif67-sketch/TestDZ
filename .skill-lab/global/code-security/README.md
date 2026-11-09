# Code Security Skill

A reusable security rule set for code implementation and review. The agent-facing instructions are in `SKILL.md`; detailed vulnerability guidance and examples are in `rules/`.

## Runtime use

1. Make this skill available through the repository's configured skill-loading workflow.
2. Consult `SKILL.md` when implementing or reviewing security-sensitive code.
3. Read only the relevant rule files from `rules/` for the current language, framework, and data flow.
4. Treat findings as evidence-based: trace attacker-controlled input to the relevant operation and account for existing protections.

The directory `.skill-lab/global/code-security` is this repository's skill source. Its presence alone does not prove that a particular OpenCode installation has discovered or loaded it; that depends on the project's skill-loader configuration.

## Rule categories

There are 28 rule files, grouped by impact:

- **Critical:** SQL injection, command injection, XSS, XXE, path traversal, insecure deserialization, code injection, hardcoded secrets, memory safety.
- **High:** insecure cryptography, insecure transport, SSRF, JWT authentication, CSRF, prototype pollution, unsafe functions, Terraform AWS/Azure/GCP, Kubernetes, Docker, GitHub Actions.
- **Medium:** ReDoS, race conditions, code correctness.
- **Low:** best practices, performance, maintainability.

See `rules/_sections.md` for the canonical index, descriptions, and filenames.

## Repository structure

```
code-security/
├── SKILL.md
├── README.md
└── rules/
    ├── _sections.md
    ├── _template.md
    └── *.md
```

## Maintaining rules

- Keep filenames and impact levels aligned with `rules/_sections.md`.
- Use `rules/_template.md` as the starting point for new rule documents.
- Include concrete vulnerable and safer patterns where appropriate.
- Prefer current, framework-specific APIs and link authoritative references.
- Update `SKILL.md` and this README whenever a rule is added, removed, renamed, or reclassified.
- Validate every referenced rule path and review examples for correctness before committing changes.

This README describes the skill source. Build, packaging, and publishing commands belong to the upstream project or its dedicated contributor tooling; do not assume those commands are available from this skill directory.
