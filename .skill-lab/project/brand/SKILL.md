---
name: brand
description: Brand voice, visual identity, messaging frameworks, asset management, and brand consistency. Use for brand guidelines, branded content, tone of voice, visual identity, and asset reviews.
metadata:
  author: project-skill
  version: "1.1.0"
---

# Brand

Manage brand identity, voice, messaging, asset organization, and consistency.

## When to Use
- Define or apply brand voice, tone, and messaging.
- Create or update visual identity guidelines, typography, and color palettes.
- Organize, name, validate, and review brand assets.
- Audit content or assets against an existing brand guide.

## Scope and Skill Routing
- This skill owns brand identity, voice, messaging, guidelines, and brand asset governance.
- Delegate token architecture and token validation to `design-system`.
- Delegate implementation of styles in application interfaces to `ui-styling`.
- Delegate logo, icon, and standalone creative production to `design`.
- Delegate banner production to `banner-design` and presentation production to `slides`.
- Do not duplicate those skills' workflows. Supply brand constraints and review their output.

## Safe Workflow
1. Inspect the existing brand guide and project structure before proposing changes.
2. Treat existing brand files and design tokens as user data. Never overwrite them without an explicit request.
3. Make a dry run or preview before running a write operation when supported.
4. Back up existing files before a multi-file update, and stop if any required step fails.
5. Report exactly which files changed and which checks were run.

## Quick Start

Run commands from the project root:

```bash
node <skill-directory>/scripts/inject-brand-context.cjs --json
node <skill-directory>/scripts/validate-asset.cjs <asset-path> --json
node <skill-directory>/scripts/extract-colors.cjs --palette --json
```

Replace `<skill-directory>` with the installed location of this skill. Do not assume a Claude-specific environment variable or installation path.

## Brand-to-Token Sync

The sync utility is an opt-in operation, not an automatic step. First inspect:
- `docs/brand-guidelines.md`
- `assets/design-tokens.json`
- the project's token-generation workflow

Preview first:

```bash
node <skill-directory>/scripts/sync-brand-to-tokens.cjs --dry-run
```

Only run the write operation after the user explicitly requests synchronization. The utility must stop on invalid or missing required colors, preserve existing semantic status colors unless explicitly defined in the guide, create recoverable backups, and fail visibly if CSS generation fails.

The design-system skill owns token schema and CSS generation. Do not invent or silently replace token structures.

## References
- Voice: `references/voice-framework.md`
- Visual identity: `references/visual-identity.md`
- Messaging: `references/messaging-framework.md`
- Consistency: `references/consistency-checklist.md`
- Guidelines template: `references/brand-guideline-template.md`
- Asset organization: `references/asset-organization.md`
- Color management: `references/color-palette-management.md`
- Typography: `references/typography-specifications.md`
- Logo usage: `references/logo-usage-rules.md`
- Approval checklist: `references/approval-checklist.md`
- Update workflow: `references/update.md`

## Scripts
- `inject-brand-context.cjs`: extracts context from a brand guide; it does not modify files.
- `sync-brand-to-tokens.cjs`: previews or synchronizes palette tokens when explicitly requested.
- `validate-asset.cjs`: checks filename, supported extension, file size, and optional manifest registration. It does not inspect image dimensions or image color pixels.
- `extract-colors.cjs`: parses palette values from a brand guide and prepares optional external extraction instructions; it does not itself run k-means or inspect image pixels.

## Interaction
OpenCode should gather missing brand decisions conversationally. Do not assume slash commands, `AskUserQuestion`, Claude task orchestration, or command argument variables are available. Ask one focused question when a decision is essential; otherwise state assumptions and proceed with a read-only review.
