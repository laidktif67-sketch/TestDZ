# Agent Instructions — TestDZ

These instructions apply to the entire repository, including `frontend/`.

## Mandatory UI/UX Pro Max workflow

For every task that changes or evaluates the user interface, user experience, visual design, layout, responsive behavior, styling, or frontend components:

1. **Use the locally installed UI/UX Pro Max skill before planning or editing.** Do not rely on memory alone.
2. Locate and read the installed skill instructions. The skill was installed locally by the project owner under `.agents/skills/`. Do not assume a path: inspect the directory and find the UI/UX Pro Max `SKILL.md` (for example, search for `*ui-ux-pro-max*/SKILL.md`).
3. Locate and use the skill's design-system/search script and follow its documented workflow. Search for recommendations relevant to this product, task, and actual frontend stack. Read the script's help/instructions if needed; do not guess its CLI arguments.
4. Summarize the relevant design-system decisions before implementation: visual direction, colors, typography, spacing/layout, responsive behavior, interaction states, and accessibility.
5. Apply the recommendations consistently. Do not invent a new visual language when the task is to refine an existing page; preserve established product identity unless the owner asks for a redesign.

If the skill directory or its scripts are unavailable in the current agent environment, say so clearly. Do not claim that the skill was used. Ask the owner to make the local skill available or provide its relevant output before proceeding with substantial visual changes.

## TestDZ project safeguards

- Inspect the existing page, components, styles, routes, and relevant assets before editing.
- Preserve the current architecture, routing, Supabase integration, authentication flows, data contracts, and existing functionality unless the owner explicitly authorizes a change.
- Keep changes scoped to the requested page or component. Avoid broad/global CSS changes and avoid adding competing override stylesheets.
- Check existing design tokens and reuse them where appropriate.
- Treat mobile and desktop as distinct responsive experiences. Verify small-screen layout, desktop alignment, overflow, typography, spacing, and interaction states.
- Use supplied reference screenshots as the visual source of truth. Compare the implementation against them when preview/screenshot access is available.
- Never claim visual verification, successful tests, or a successful build unless they were actually performed in the current environment.
- Do not run repeated production builds for every small CSS iteration. Use the available development preview for iterative visual checks and run a build at an appropriate verification milestone.
- Do not modify environment files, secrets, Supabase schema/data/policies, authentication configuration, or deployment settings unless explicitly requested.
- Do not delete user files, local untracked files, or local agent/skill configuration.

## Completion report

At the end of a UI task, report:
- Which UI/UX Pro Max skill guidance and design-system recommendations were applied.
- Files changed and the purpose of each change.
- What was actually verified (and what was not).
- Any remaining visual checks that require the owner's device or screenshot.

For non-UI tasks, use the relevant project instructions and do not force an unrelated design workflow.
