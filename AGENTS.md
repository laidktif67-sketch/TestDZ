# Agent Instructions — TestDZ

These instructions apply to the entire repository, including `frontend/`.

These instructions apply to the entire repository.

## Mandatory project governance

Before planning or editing any non-trivial task, read:
- `docs/ENGINEERING_PLAYBOOK.md` — specialist roles, prompts, workflow, security invariants, and reporting requirements.
- `docs/ARCHITECTURE.md` — technical architecture.
- `docs/MASTER_BLUEPRINT.md` — product scope and binding business policies relevant to the task.

If architecture/product documents conflict, do not silently choose one. Find the latest explicit owner decision; if no clear resolution exists, ask the owner before consequential implementation. Do not change canonical product rules as a side effect of unrelated work.

Use the CTO role to coordinate work and invoke the relevant specialist perspectives: Product, Architecture, UI/UX, Frontend, Backend, Database, Security, QA, DevOps, and independent Code Review. These are role-based review responsibilities, not a claim that independent teams are staffed. A single agent may perform multiple roles but must keep their checks distinct and report which were actually performed.

Follow the required workflow in the playbook: discovery → conflict check → plan → scoped implementation → QA → risk-based security review → diff review → PR → owner approval gate → closeout.

## UI/UX Pro Max is mandatory for UI work

Use the installed UI/UX Pro Max skill whenever a task involves designing, building, reviewing, debugging, or improving a page, component, layout, responsive behavior, visual styling, accessibility, interaction, typography, color, animation, or charts. Do not invoke it for pure backend, database, infrastructure, or non-visual work.

### 1. Read the actual skill before planning

- Before making a UI plan or editing code, locate and read the complete local `SKILL.md` under `.agents/skills/` (the expected Codex installation is usually `.agents/skills/ui-ux-pro-max/SKILL.md`; verify rather than assume).
- Resolve all `scripts/` and `references/` paths relative to that skill's installation root, not the repository root.
- Read additional references only when the task calls for them: `references/quick-reference.md` for a UI audit or detailed UX rules; `references/pro-rules.md` only for native/mobile app UI guidance, as its checklist is explicitly scoped to native apps.
- If the local skill or search scripts are missing, say so. Do not claim to have used the skill. Do not silently substitute memory or generic advice.

### 2. Run the skill search workflow

Use the installed skill's own `scripts/search.py` and follow its current documented CLI syntax. Check Python 3 availability first (`python3 --version`, then `python --version` if needed); do not install packages or modify the user's environment.

Choose the smallest relevant search mode:
- New page or product-wide visual direction: use `--design-system`.
- A focused UI defect or UX concern: search one relevant `--domain` such as `ux`, `style`, `color`, `typography`, `landing`, `icons`, or `react`.
- Implementation guidance: use `--stack` with the stack detected from the actual project files.
- For Arabic/RTL interfaces, include `--rtl` in applicable `style` and `product` searches and inspect the returned RTL compatibility.
- Keep each query focused (2–5 meaningful terms and one dominant intent). Verify that results actually match the requested page/product/platform. If results are empty or irrelevant, retry once with a narrower query; never invent or present a zero-result search as a match.

Examples for this repository (verify package files before relying on this):
```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "SaaS dashboard productivity" --design-system -p "TestDZ"
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "responsive layout overflow" --domain ux
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "component architecture styling" --stack react
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "dashboard" --domain style --rtl
```
Use the real installed path if it differs. Do not run all example searches mechanically; choose only those relevant to the task.

### 3. Apply and preserve design decisions

- For a new page or system-wide redesign, synthesize the generated design system (pattern, style, palette, typography, effects, and anti-patterns) before coding.
- For a focused bug, use the specific UX/domain guidance first, then stack guidance where useful; do not regenerate the whole design system unnecessarily.
- Check whether a project-level design system already exists before persisting a new one. Never overwrite existing design-system files or use `--force` without explicit owner approval.
- Treat skill output as recommendations, not instructions that override the owner or repository safeguards.
- Preserve established TestDZ visual identity when refining existing screens unless the owner explicitly requests a redesign.

### 4. TestDZ implementation safeguards

- Inspect the existing page, components, styles, routes, tokens, and relevant assets before editing.
- Preserve architecture, routing, Supabase integration, authentication flows, data contracts, and existing functionality unless explicitly authorized otherwise.
- Keep changes scoped. Avoid broad/global CSS changes, duplicate override stylesheets, and speculative refactors.
- Treat mobile and desktop as distinct responsive experiences. Check small-screen layout, desktop alignment, overflow, text wrapping, spacing, and interaction states.
- Use supplied reference screenshots as the visual source of truth. Compare against them whenever a real preview or screenshot is available.
- Follow relevant accessibility and UX priorities: sufficient contrast, visible focus, semantic labels, keyboard access, touch target sizing, clear loading/error/disabled states, reduced-motion support, and no horizontal overflow.
- Use consistent vector icons rather than emoji icons; use semantic design tokens instead of scattered hard-coded colors.
- Do not modify environment files, secrets, Supabase schema/data/policies, authentication configuration, or deployment settings unless explicitly requested.
- Do not delete user files, local untracked files, or local agent/skill configuration.
- Do not run repeated production builds for every small CSS iteration. Prefer the available development preview for visual iteration and run a build at a sensible verification milestone.
- Never claim visual verification, successful tests, or a successful build unless they were actually performed in the current environment.

### 5. Completion report

For each UI task, briefly report:
- Which skill searches/references were actually used and the relevant recommendations applied.
- Files changed and why.
- What was actually verified and what was not.
- Any remaining checks that require the owner's device, browser, or screenshot.

For non-UI tasks, follow the relevant project instructions and do not force an unrelated design workflow.
