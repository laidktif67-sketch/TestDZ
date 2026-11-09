---
name: design-system
description: Design-token architecture, component specifications, CSS variables, spacing and typography scales, and token validation. Use for systematic design foundations and brand-compliant UI implementation.
argument-hint: "[component or token]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Design System

Token architecture, component specifications, and systematic design foundations.

## When to Use

- Design token creation
- Component state definitions
- CSS variable systems
- Spacing/typography scales
- Design-to-code handoff
- Tailwind theme configuration
- Preparing design tokens and validation support for presentation projects (delegate slide creation to the `slides` skill).

## Token Architecture

Load: `references/token-architecture.md`

### Three-Layer Structure

```
Primitive (raw values)
       ↓
Semantic (purpose aliases)
       ↓
Component (component-specific)
```

**Example:**
```css
/* Primitive */
--color-blue-600: #2563EB;

/* Semantic */
--color-primary: var(--color-blue-600);

/* Component */
--button-bg: var(--color-primary);
```

## Script Paths

Script paths are relative to this skill's directory: `scripts/<file>` refers to this skill's own scripts, and `references/<file>` to its references. In OpenCode, resolve these paths from the installed skill directory supplied by the skill runtime; do not assume Claude-specific environment variables or installation paths. Keep the working directory at the target project root because project assets such as `docs/brand-guidelines.md`, `assets/design-tokens.json`, and `src/` are resolved relative to it.

## Quick Start

**Generate tokens:**
```bash
node scripts/generate-tokens.cjs --config tokens.json -o tokens.css
```

**Validate usage:**
```bash
node scripts/validate-tokens.cjs --dir src/
```

## References

| Topic | File |
|-------|------|
| Token Architecture | `references/token-architecture.md` |
| Primitive Tokens | `references/primitive-tokens.md` |
| Semantic Tokens | `references/semantic-tokens.md` |
| Component Tokens | `references/component-tokens.md` |
| Component Specs | `references/component-specs.md` |
| States & Variants | `references/states-and-variants.md` |
| Tailwind Integration | `references/tailwind-integration.md` |

## Component Spec Pattern

| Property | Default | Hover | Active | Disabled |
|----------|---------|-------|--------|----------|
| Background | primary | primary-dark | primary-darker | muted |
| Text | white | white | white | muted-fg |
| Border | none | none | none | muted-border |
| Shadow | sm | md | none | none |

## Scripts

| Script | Purpose |
|--------|---------|
| `generate-tokens.cjs` | Generate CSS from JSON token config |
| `validate-tokens.cjs` | Check for hardcoded values in code |
| `search-slides.py` | BM25 search + contextual recommendations |
| `slide-token-validator.py` | Validate slide HTML for token compliance |
| `fetch-background.py` | Fetch images from Pexels/Unsplash |

## Templates

| Template | Purpose |
|----------|---------|
| `design-tokens-starter.json` | Starter JSON with three-layer structure |

## Integration

**With brand:** Extract primitives from brand colors/typography
**With ui-styling:** Component tokens → Tailwind config

**Skill Dependencies:** brand, ui-styling
**Primary Agents:** ui-ux-designer, frontend-developer

## Slide System

Supporting reference data and utilities for presentation projects. This skill owns design tokens and token validation; the `slides` skill owns presentation planning, slide content, layout, generation, and delivery. Use the CSV data and token utilities here only when the `slides` workflow needs them.

### Source of Truth

| File | Purpose |
|------|---------|
| `docs/brand-guidelines.md` | Brand identity, voice, colors |
| `assets/design-tokens.json` | Token definitions (primitive→semantic→component) |
| `assets/design-tokens.css` | CSS variables (import in slides) |
| `assets/css/slide-animations.css` | CSS animation library |

### Supporting Slide Reference Data

The slide datasets in `data/` and helper scripts are supporting resources, not a second slide-creation workflow. Do not independently plan or generate a deck from this skill; route presentation requests to the `slides` skill. When that workflow needs token embedding or validation, use the relevant scripts below.

### Slide Search Utility (BM25)

```bash
# Basic search (auto-detect domain)
python scripts/search-slides.py "investor pitch"

# Domain-specific search
python scripts/search-slides.py "problem agitation" -d copy
python scripts/search-slides.py "revenue growth" -d chart

# Contextual search (Premium System)
python scripts/search-slides.py "problem slide" --context --position 2 --total 9
python scripts/search-slides.py "cta" --context --position 9 --prev-emotion frustration
```

### Decision System CSVs

| File | Purpose |
|------|---------|
| `data/slide-strategies.csv` | 15 deck structures + emotion arcs + sparkline beats |
| `data/slide-layouts.csv` | 25 layouts + component variants + animations |
| `data/slide-layout-logic.csv` | Goal → Layout + break_pattern flag |
| `data/slide-typography.csv` | Content type → Typography scale |
| `data/slide-color-logic.csv` | Emotion → Color treatment |
| `data/slide-backgrounds.csv` | Slide type → Image category (Pexels/Unsplash) |
| `data/slide-copy.csv` | 25 copywriting formulas (PAS, AIDA, FAB) |
| `data/slide-charts.csv` | 25 chart types with Chart.js config |

### Presentation Integration Contract

- `slides` is the single owner of presentation creation and delivery.
- `design-system` supplies design tokens, brand-aligned component rules, supporting slide datasets, and token validation utilities.
- Do not duplicate slide-generation instructions, presentation commands, or deck workflows in this skill.
- Presentation HTML must still comply with the project's design tokens; use `slide-token-validator.py` or `html-token-validator.py` where appropriate.

### Token Compliance

```css
/* CORRECT - uses token */
background: var(--slide-bg);
color: var(--color-primary);
font-family: var(--typography-font-heading);

/* WRONG - hardcoded */
background: #0D0D0D;
color: #FF6B6B;
font-family: 'Space Grotesk';
```

### Reference Implementation

Working example with all features:
```
assets/designs/slides/claudekit-pitch-251223.html
```

## Best Practices

1. Never use raw hex in components - always reference tokens
2. Semantic layer enables theme switching (light/dark)
3. Component tokens enable per-component customization
4. Use HSL format for opacity control
5. Document every token's purpose
6. **Slides must import design-tokens.css and use var() exclusively**
