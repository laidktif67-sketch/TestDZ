---
name: code-review
description: "Review changes since a user-supplied fixed point on two independent axes: repository standards and the originating spec. Use for branch, pull request, work-in-progress, or 'review since X' requests. Designed for OpenCode; uses independent subagent reviews when available and a transparent sequential fallback otherwise."
---

# Two-axis code review

Review the diff between `HEAD` and a fixed point supplied by the user. Keep the two axes independent:

- **Standards** — does the change follow the repository's documented coding standards?
- **Spec** — does the change faithfully implement the originating issue or specification?

Do not edit code during a review. Report findings, evidence, and uncertainty; do not silently fix issues.

## 1. Pin and validate the fixed point

Use the exact fixed point supplied by the user (commit SHA, branch, tag, `main`, `HEAD~5`, etc.). If none was supplied, ask for it before reviewing.

Capture these commands and their outputs once:

```bash
git rev-parse <fixed-point>
git diff --merge-base <fixed-point> HEAD
git log <fixed-point>..HEAD --oneline
```

The diff is equivalent to the three-dot comparison: `git diff <fixed-point>...HEAD`. Confirm the ref resolves and the diff is non-empty before proceeding. If the ref is invalid or the diff is empty, stop and explain why; do not delegate an invalid review.

If the user asks to review a pull request, use the PR's base/head comparison and identify both refs explicitly. Do not assume the default branch.

## 2. Find the originating spec (tracker integration is optional)

Do not assume an issue tracker, plugin, MCP server, or setup command is installed.

Search in this order:

1. Issue or PR references in the relevant commit messages (for example `#123`, `Closes #45`, or a GitLab reference). If the repository's configured issue-tracker integration is available, use its documented workflow to fetch the referenced item.
2. A spec path explicitly supplied by the user.
3. A matching spec under `docs/`, `specs/`, or `.scratch/`, using the branch name or feature description.
4. Repository issue/PR records accessible through an already configured GitHub or Git provider integration, if available.

Never tell the user to run a hard-coded slash command or install a particular tracker integration. If no spec is found, ask the user whether they can provide its location or confirm that no spec exists. If they confirm there is no spec, skip the Spec review and state **"No spec available; Spec axis skipped."**

## 3. Identify repository standards

Search the repository for files that define coding and contribution rules. Include all relevant sources, and always include `CODING_STANDARDS.md` and `CONTRIBUTING.md` when they exist. Also consider relevant package-level guidance, `AGENTS.md`, and directory-specific instructions that apply to changed files.

Do not invent standards or assume a conventional file exists. Record the exact paths found. If no documented standards exist, say so; the Standards axis still applies the heuristic baseline below.

### Fowler smell baseline

Apply these as labelled judgement calls, never as automatic violations. Documented repository standards override this baseline. Skip anything already enforced by tooling.

- **Mysterious Name** — a name does not reveal what a function, variable, or type does or holds.
- **Duplicated Code** — the same logic shape appears in multiple changed hunks or files.
- **Feature Envy** — a method reaches into another object's data more than its own.
- **Data Clumps** — the same small group of fields or parameters repeatedly travels together.
- **Primitive Obsession** — a primitive stands in for a domain concept that deserves a type.
- **Repeated Switches** — the same conditional cascade on the same type recurs across the change.
- **Shotgun Surgery** — one logical change forces scattered edits across many files.
- **Divergent Change** — one file or module is changed for several unrelated reasons.
- **Speculative Generality** — abstractions or hooks are added for needs the spec does not have.
- **Message Chains** — callers depend on long navigation chains they should not need to know.
- **Middle Man** — a class or function mostly delegates without adding value.
- **Refused Bequest** — a subtype ignores or overrides most inherited behavior.

Treat each smell as a possible design concern, not a demand to refactor. Quote the relevant changed hunk and explain why it may be a smell.

## 4. Run the two independent reviews

### Preferred: OpenCode subagents

When the OpenCode `subagent` tool is available and permitted:

- Launch two independent child reviews with fresh context, one for Standards and one for Spec.
- Use the built-in `general` subagent or an available configured subagent; do not assume custom agent names exist.
- Start both reviews in parallel rather than waiting for one before launching the other.
- Give each child the exact diff, commit list, and only the material needed for its axis.
- The Standards child must receive the complete standards-source path list and the full Fowler smell baseline above.
- The Spec child must receive the located spec text or path and the relevant diff.
- Ask each child to return fewer than 400 words, with file/hunk evidence.

If the subagent tool is unavailable, denied, or cannot run two independent reviews, perform the two passes sequentially in the current session using clearly separated analysis. State in the final report that the sequential fallback was used; never claim parallel subagents ran when they did not.

### Standards review prompt

"Review the supplied diff against the listed repository standards and the complete Fowler smell baseline. For each finding, identify the file and changed hunk. (a) Report every applicable documented-standard breach and cite the exact standard file and rule. (b) Report possible baseline smells by name and quote the relevant changed hunk. Distinguish hard documented-standard violations from heuristic judgement calls. Repository standards override the smell baseline. Skip issues already enforced by tooling. Do not propose unrelated refactors. Under 400 words."

### Spec review prompt

"Review the supplied diff against the supplied originating spec. Report: (a) requirements that are missing or only partially implemented; (b) changed behavior not requested by the spec (scope creep); and (c) requirements that appear implemented but whose implementation looks incorrect. For each finding, quote the relevant spec line and identify the changed file/hunk. Do not invent requirements. Under 400 words."

If there is no spec after the user confirms none exists, do not run this prompt.

## 5. Aggregate without collapsing the axes

Present the reports under exactly these headings:

- `## Standards`
- `## Spec`

Keep the two reports verbatim or lightly cleaned. Do not merge, rank, or trade off findings across axes. Preserve severity only when supported by evidence; distinguish confirmed defects from risks and judgement calls.

End with one concise line giving the finding count for each axis and the worst issue **within each axis**, if any. If the Spec axis was skipped, say so explicitly.

## Why two axes

A change can satisfy repository conventions while implementing the wrong behavior, or implement the requested behavior while violating repository conventions. Keeping the axes separate prevents one from masking the other.
