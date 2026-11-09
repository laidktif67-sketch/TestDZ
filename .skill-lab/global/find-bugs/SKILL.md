---
name: find-bugs
description: Find bugs, security vulnerabilities, and code quality issues in local branch changes. Use when asked to review changes, find bugs, security review, or audit code on the current branch.
---

# Find Bugs

Review the changes in the current working branch for security vulnerabilities, bugs, and significant code quality issues. Perform a read-only review: do not modify files, apply fixes, create commits, or change repository settings.

Use only tools and capabilities actually available in the current environment. Do not assume that GitHub CLI, a particular remote name, network access, subagents, or external services are installed or configured. If a capability is unavailable, use the documented fallback or state the limitation.

## Phase 1: Establish Scope and Gather Complete Input

1. Identify the current repository, branch, and working-tree state:
   - `git status --short --branch`
   - `git branch --show-current`
   - `git remote -v`
2. Identify the intended base branch. Prefer the locally configured default-branch reference when available:
   - `git symbolic-ref --quiet --short refs/remotes/origin/HEAD`
   If that reference is unavailable, inspect the repository's configured branches and tracking information. Do not guess a base branch or silently substitute an unrelated branch. If the correct base cannot be established from available information, ask the user to identify it before reviewing branch changes.
3. Verify that the base and current branch have a common ancestor, then determine the merge base:
   - `git merge-base <base-ref> HEAD`
   Use the resulting commit to inspect committed branch changes:
   - `git diff --no-ext-diff --unified=80 <merge-base> HEAD`
4. Also inspect changes not yet committed:
   - `git diff --no-ext-diff --unified=80 HEAD`
   This includes staged and unstaged tracked-file changes.
5. List changed paths from both comparisons and list untracked files:
   - `git diff --name-only <merge-base> HEAD`
   - `git diff --name-only HEAD`
   - `git ls-files --others --exclude-standard`
   Inspect relevant untracked files when they are part of the requested change scope; do not ignore them merely because Git does not include them in a diff.
6. If any diff is truncated, inspect the affected files and their surrounding context until every relevant changed line has been reviewed. Do not claim complete coverage while any relevant input remains unread.
7. If there are no changes in the requested scope, report that clearly and do not invent findings. If only part of the scope can be inspected, state exactly what was and was not reviewed.

## Phase 2: Map the Attack Surface

For every changed file, inspect the complete relevant file and its surrounding call sites. Identify applicable items:

- User-controlled inputs: request parameters, headers, body, URL components, files, environment variables, and configuration.
- Data access: database queries, reads, writes, transactions, and persistence boundaries.
- Authentication and authorization checks, including ownership and tenant boundaries.
- Session, token, and other security-sensitive state operations.
- External calls, network requests, subprocesses, and integrations.
- Cryptographic operations, secret handling, and trust boundaries.
- Important business rules, state transitions, and calculations.

Trace security-sensitive behavior into related unchanged code when necessary. Clearly distinguish inspected evidence from assumptions.

## Phase 3: Security and Correctness Checklist

Evaluate every item for each changed file where it applies. Mark an item as not applicable only with a brief reason; do not treat an unexamined item as clean.

- [ ] **Injection:** SQL, command, template, header, path, and other injection risks.
- [ ] **XSS:** Are untrusted values safely handled in every relevant output context?
- [ ] **Authentication:** Are protected operations authenticated and authentication failures handled?
- [ ] **Authorization / IDOR:** Are permissions, ownership, and resource boundaries enforced server-side?
- [ ] **CSRF:** Are state-changing browser requests appropriately protected?
- [ ] **Race conditions:** Are read-then-write flows, TOCTOU windows, and concurrent updates safe?
- [ ] **Session and tokens:** Are fixation, expiration, rotation, storage, and secure cookie attributes handled where relevant?
- [ ] **Cryptography and secrets:** Are secure algorithms and randomness used, and are secrets excluded from logs and client exposure?
- [ ] **Information disclosure:** Could errors, responses, logs, or timing reveal sensitive information?
- [ ] **Denial of service:** Are expensive or unbounded operations, resource use, and rate limits handled?
- [ ] **Business logic and data integrity:** Are edge cases, invalid state transitions, numeric limits, validation, idempotency, and duplicate operations handled?
- [ ] **Dependencies and configuration:** Do changed dependencies, permissions, build settings, or deployment configuration introduce risk?

## Phase 4: Verify Potential Findings

For each suspected issue:

1. Trace the relevant code path and inspect surrounding context.
2. Check whether another layer already prevents or mitigates the issue.
3. Search for existing tests and verify whether they cover the specific scenario.
4. Run relevant existing tests or safe static checks only when the required tools and dependencies are available. Do not install packages, change configuration, or modify files as part of this read-only review.
5. Do not claim a test was run unless it was actually executed. Distinguish confirmed defects from plausible risks that need further verification.
6. Avoid duplicate findings for the same root cause. Do not report stylistic preferences or speculative issues as bugs.

## Phase 5: Pre-Conclusion Audit

Before presenting findings:

1. List every file reviewed and state whether its relevant contents were read completely.
2. Summarize each checklist item as **Issue found**, **No issue observed**, or **Not applicable**, with concise evidence or a reason.
3. List tests and checks actually executed, with their results; separately list checks not run and why.
4. Identify any files, call paths, runtime behavior, or assumptions that could not be fully verified.
5. Recheck each proposed finding against the evidence and surrounding code. If evidence is insufficient, label it unconfirmed or omit it.

## Output Format

Prioritize security vulnerabilities, then correctness bugs, then significant code quality issues. Present actionable findings first.

For each finding include:

- **File:Line** — concise title and location.
- **Severity:** Critical / High / Medium / Low.
- **Problem:** What can happen and under what conditions.
- **Evidence:** The code path and reason this is a real issue; mention relevant existing safeguards or tests checked.
- **Fix:** A concrete remediation direction.
- **References:** OWASP, RFCs, or other standards when directly relevant.

Then provide the review scope, files reviewed, checklist summary, tests/checks run, and limitations. If no significant issues are found, say so plainly and summarize what was actually reviewed. Never invent issues to fill the report.

## OpenCode Execution Guidance

- Work within the current OpenCode session and use only its available repository, terminal, and review capabilities.
- Do not invoke Claude-specific commands, plugin paths, environment variables, or interaction APIs.
- If parallel review agents are explicitly available and useful, they may be used for independent review tasks; otherwise perform the review sequentially. The final reviewer must reconcile duplicate or conflicting reports against the code.
- Ask the user only for information essential to establish scope or resolve a genuine blocker.

## Review Boundary

This skill is review-only. Do not make changes. Report findings and let the user decide what to address.
