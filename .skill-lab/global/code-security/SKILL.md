---
name: code-security
description: "Secure coding guidance for implementation and review. Consult when code handles untrusted input, authentication, authorization, files, databases, network requests, cryptography, secrets, or infrastructure such as Terraform, Kubernetes, Docker, and GitHub Actions. Also use for security questions and code reviews where security risks are in scope."
---

# Code Security Guidelines

Use these guidelines proactively when implementing or reviewing code with security-sensitive behavior. Apply only the rules relevant to the language, framework, data flow, and trust boundaries in the current task.

This skill is a rule index, not a substitute for understanding the repository or verifying framework-specific behavior. Do not claim that a vulnerability exists unless the inspected code supports that finding.

## Operating workflow

1. Identify the language, framework, entry points, sensitive assets, trust boundaries, and attacker-controlled inputs.
2. Trace relevant data from sources to sinks (for example, request input to SQL, shell, HTML, file paths, URLs, or deserialization).
3. Select the smallest relevant set of rule files from the index below.
4. Read those files from this skill's `rules/` directory before applying detailed guidance. Resolve paths relative to this `SKILL.md` file; do not assume the agent's working directory is the skill directory.
5. Prioritize exploitable Critical and High risks, then assess Medium and Low risks in context.
6. For reviews, report evidence, impact, exploitability, and the affected location. Separate confirmed findings from hypotheses and recommendations.
7. For implementation, use the framework's safe APIs and add focused tests where practical.

## Rule selection by language and technology

| Language / technology | Start with these rules when relevant |
|---|---|
| Python | SQL injection, command injection, path traversal, code injection, SSRF, insecure cryptography, insecure deserialization |
| JavaScript / TypeScript | XSS, prototype pollution, code injection, insecure transport, CSRF, SSRF, secrets |
| Java | SQL injection, XXE, insecure deserialization, insecure cryptography, SSRF |
| Go | SQL injection, command injection, path traversal, insecure transport, SSRF |
| C / C++ | Memory safety, unsafe functions, command injection, path traversal |
| Ruby | SQL injection, command injection, code injection, insecure deserialization |
| PHP | SQL injection, XSS, command injection, code injection, path traversal |
| Terraform / HCL | Terraform AWS, Terraform Azure, Terraform GCP, secrets |
| YAML / infrastructure | Kubernetes, Docker, GitHub Actions, secrets |

This table is a starting point, not an exhaustive language support claim. Use the actual rule files and repository context to determine coverage. For languages or frameworks not listed, apply relevant general principles only when supported by the code and available rule content.

## Rule index

Rule files are stored under `rules/`. Read the specific file before relying on its detailed examples.

### Critical impact

- **SQL injection** — `rules/sql-injection.md`
- **Command injection** — `rules/command-injection.md`
- **Cross-site scripting (XSS)** — `rules/xss.md`
- **XML external entities (XXE)** — `rules/xxe.md`
- **Path traversal** — `rules/path-traversal.md`
- **Insecure deserialization** — `rules/insecure-deserialization.md`
- **Code injection** — `rules/code-injection.md`
- **Hardcoded secrets** — `rules/secrets.md`
- **Memory safety** — `rules/memory-safety.md`

### High impact

- **Insecure cryptography** — `rules/insecure-crypto.md`
- **Insecure transport** — `rules/insecure-transport.md`
- **Server-side request forgery (SSRF)** — `rules/ssrf.md`
- **JWT authentication** — `rules/authentication-jwt.md`
- **Cross-site request forgery (CSRF)** — `rules/csrf.md`
- **Prototype pollution** — `rules/prototype-pollution.md`
- **Unsafe functions** — `rules/unsafe-functions.md`
- **Terraform AWS** — `rules/terraform-aws.md`
- **Terraform Azure** — `rules/terraform-azure.md`
- **Terraform GCP** — `rules/terraform-gcp.md`
- **Kubernetes** — `rules/kubernetes.md`
- **Docker** — `rules/docker.md`
- **GitHub Actions** — `rules/github-actions.md`

### Medium impact

- **Regular-expression denial of service (ReDoS)** — `rules/regex-dos.md`
- **Race conditions** — `rules/race-condition.md`
- **Code correctness** — `rules/correctness.md`

### Low impact

- **Best practices** — `rules/best-practice.md`
- **Performance** — `rules/performance.md`
- **Maintainability** — `rules/maintainability.md`

The canonical category descriptions and ordering are maintained in `rules/_sections.md`. If this index and that file ever differ, flag the mismatch rather than silently inventing or renaming a rule.

## Review and reporting guidance

When reviewing code:

- Cite the exact file and line or the smallest useful code location.
- Explain the attacker-controlled input, vulnerable operation, and missing control.
- State realistic impact and required preconditions.
- Prefer actionable remediation that fits the existing architecture.
- Do not report a pattern as exploitable without tracing its data flow and relevant protections.
- Do not expose secrets in findings; redact values and identify the secret type/location.
- Avoid duplicating the same root cause across multiple findings.
- If evidence is insufficient, label the item as a question or verification task, not a confirmed vulnerability.

## Quick reference

| Risk | Core defensive approach |
|---|---|
| SQL injection | Parameterized queries and safe query APIs |
| XSS | Context-aware output encoding and safe DOM/framework APIs |
| Command injection | Avoid shell invocation; otherwise pass arguments safely and validate allowlisted inputs |
| Path traversal | Constrain resolved paths to an intended base directory |
| SSRF | Validate destinations, restrict schemes/hosts, and block internal or metadata ranges |
| Secrets | Keep credentials out of source and logs; use approved secret storage |
| Cryptography | Use vetted libraries and modern, fit-for-purpose algorithms |
| Authentication | Verify identity, signatures, expiry, issuer, audience, and authorization separately |
| Infrastructure | Apply least privilege, private-by-default networking, and secure workload settings |
