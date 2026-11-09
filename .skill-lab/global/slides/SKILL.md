---
name: slides
description: Create strategic HTML presentations and pitch decks with persuasive storytelling, responsive slide layouts, accessible data visualization, and optional design-token integration.
argument-hint: "[presentation topic and audience]"
metadata:
  author: project
  version: "2.0.0"
---

# Slides

The single owner for presentation planning, slide narratives, content, HTML implementation, navigation, and final review.

## When to Use

- Investor, sales, marketing, product, training, and internal presentations
- Pitch decks and data-led presentations
- Slide narrative, layout, copywriting, and HTML presentation delivery

## Ownership and Boundaries

- This skill owns the complete presentation workflow and its slide-specific knowledge.
- Use `design-system` only for design tokens, component specifications, and token validation. It does not own slide planning or presentation generation.
- Use `brand` for approved brand voice and identity guidance when available.
- Use `design` for a separate logo, icon, or corporate identity asset—not as a second slide workflow.
- Do not invoke another slide skill or recursively invoke `slides`.
- Do not assume optional tools, browser automation, image services, or subagents are installed. Use available capabilities and report any limitation.

## References

Load only the references needed for the current task:

| Topic | File |
|---|---|
| Creation workflow and delivery checks | `references/create.md` |
| Layout patterns | `references/layout-patterns.md` |
| HTML presentation template and navigation | `references/html-template.md` |
| Copywriting formulas | `references/copywriting-formulas.md` |
| Presentation strategies and narrative arcs | `references/slide-strategies.md` |

## Workflow

1. Read `references/create.md` and identify the audience, purpose, presentation format, and required output.
2. Build a coherent narrative before designing individual slides. Choose a strategy from `references/slide-strategies.md`.
3. Select varied, content-appropriate layouts from `references/layout-patterns.md`; avoid repeating one layout without a reason.
4. Write concise slide headlines and supporting copy. Use `references/copywriting-formulas.md` as guidance, not as a substitute for evidence or audience understanding.
5. Implement the deck using `references/html-template.md` when a navigable HTML presentation is appropriate. Use semantic HTML, responsive sizing, keyboard navigation, and accessible controls.
6. If the repository contains design tokens, inspect their actual paths and names before using them. Never invent token variables or assume a particular token file exists.
7. Preview and validate the result with available tools. Check navigation, mobile/desktop sizing, overflow, contrast, links, chart labels, and console errors when a browser is available.
8. Report the output path, what was verified, and any checks that could not be performed.

## Supporting Design-System Resources

The `design-system` skill may provide slide research data and helper scripts (strategy/layout/copy/chart search and token validation). These are supporting resources only. Resolve their actual installed paths before execution; do not use hard-coded Claude paths or assume the skill is installed in a particular directory.

The optional `generate-slide.py` helper creates a token-based, vertically scrollable HTML deck from JSON. It is not the navigable template in `html-template.md`, does not use Chart.js, and requires the repository token assets expected by that script. Use it only after checking those prerequisites and explaining this output-format difference. Do not claim it provides keyboard slide navigation.

## Safety and Quality

- Do not invent metrics, customer quotes, citations, or company claims. Mark placeholders clearly when source facts are missing.
- Do not put sensitive information into public CDN or external image/chart services without permission.
- Prefer local assets and libraries already present in the project. External CDNs require a network connection and may be unavailable offline.
- Preserve existing project architecture and styling conventions. Do not overwrite existing files without explicit approval.
- Keep slide text concise, charts truthful, and all visual elements readable at presentation size.
