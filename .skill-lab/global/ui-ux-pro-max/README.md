# UI/UX Pro Max

A design-intelligence skill for researching and implementing professional user interfaces. It provides searchable design guidance for product types, visual styles, color palettes, typography, charts, UX patterns, and technology stacks.

This copy is maintained as a standalone skill for **OpenCode**. The original upstream project is [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).

## What it provides

- Searchable UI styles and product-specific design guidance.
- Industry-oriented color palettes and typography pairings.
- Landing-page patterns, chart recommendations, and UX guidelines.
- Stack-specific recommendations for React, Next.js, Vue, Svelte, Tailwind, SwiftUI, Flutter, and other supported technologies.
- Design-system generation, including recommended patterns, styles, colors, typography, effects, and anti-patterns.
- RTL-aware search for Arabic, Hebrew, and Persian interfaces.

The catalog and exact counts can change as the upstream project is updated. Treat the data files in this skill as the source of truth for the installed version.

## Requirements

- Python 3.x.
- Python standard library only for the search and design-system scripts; no Python package installation is required.

Check Python:

```bash
python3 --version
```

## Use with OpenCode

OpenCode discovers this skill through its configured skill directories. When the skill is available, ask naturally for UI/UX work, for example:

```text
Use the UI/UX Pro Max skill to design a responsive dashboard.
First inspect the existing framework, styling system, and project conventions.
Preserve the current architecture and behavior.
```

The agent should read `SKILL.md` first and follow its workflow. Do not copy Claude Code, Cursor, or other assistant-specific installation paths into OpenCode instructions.

## Search the design catalog

Run commands from this skill directory, or use the skill directory as the working directory:

```bash
python3 scripts/search.py "dashboard" --domain style
python3 scripts/search.py "fintech" --domain product
python3 scripts/search.py "elegant serif" --domain typography
python3 scripts/search.py "form validation" --domain ux
python3 scripts/search.py "responsive layout" --stack react
```

### Generate a design system

```bash
python3 scripts/search.py "beauty spa wellness" --design-system -p "Serenity Spa"
```

For Markdown output:

```bash
python3 scripts/search.py "fintech banking" --design-system -f markdown
```

For complete machine-readable results:

```bash
python3 scripts/search.py "SaaS dashboard" --domain style --json
```

### RTL search

Use RTL filtering with an explicit `style` or `product` domain:

```bash
python3 scripts/search.py "dashboard" --domain style --rtl
python3 scripts/search.py "dashboard" --domain style --rtl=full
python3 scripts/search.py "fintech" --domain product --rtl=partial
```

The catalog distinguishes full, partial, and caveat-bearing RTL compatibility. A result marked as RTL-compatible still requires checking the actual layout, content direction, icons, charts, and motion in the target interface.

## Persist a design system

The search tool can save a project-level master design system and optional page-specific overrides:

```bash
python3 scripts/search.py "SaaS dashboard" --design-system --persist -p "MyApp"
python3 scripts/search.py "SaaS dashboard" --design-system --persist -p "MyApp" --page "dashboard"
```

The generated files are written under a `design-system/` directory relative to the current working directory. Review generated output before applying it to an application.

## Validation and tests

Run these checks from this skill directory:

```bash
python3 scripts/validate_data.py
python3 scripts/generate-catalog-summary.py --check
python3 -m unittest discover -s scripts/tests -v
```

Some upstream repository-wide checks may not apply to this standalone skill package. The standalone tests should validate the files and paths that are actually shipped here; required tools and fixtures must not be silently skipped when they are expected to be present.

## Important implementation guidance

- Inspect the target project's framework and installed library versions before choosing implementation details.
- Preserve existing architecture, routing, component conventions, and business logic unless the user explicitly requests a change.
- Prefer the project's existing design tokens and component system over introducing a parallel system.
- Verify responsive behavior, accessibility, keyboard focus, contrast, reduced motion, and RTL behavior where relevant.
- Search results are design guidance, not proof that an implementation is correct. Validate the finished interface in the actual project.

## Upstream project and license

- Source repository: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- Upstream documentation: [Original README](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/README.md)
- License: [Upstream MIT License](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/LICENSE)

This README documents the standalone OpenCode-oriented copy. For upstream release history, contributor workflows, CLI installation for other agents, and premium product information, consult the original repository.
