# Update Brand Guidelines

Use this workflow when the user asks to change brand colors, typography, voice, or visual direction.

## Safety Rules

- Work from the project root and inspect the current guide and token files first.
- Do not overwrite an existing brand guide or token file without explicit user approval.
- Do not automatically synchronize files just because the guide changed.
- Preview generated token changes before writing.
- Back up every existing output before a multi-file write.
- Stop and report an error if token generation fails; do not report success for a partial sync.

## Workflow

### 1. Confirm the intended changes

Collect only the missing decisions through normal conversation:
- Theme or brand direction.
- Primary, secondary, and accent color names and valid six-digit hex values.
- Typography changes, if any.
- Voice, mood, or messaging changes, if any.

Do not assume a preset is approved merely because it appears in this reference.

### 2. Update the human-readable guide

Update `docs/brand-guidelines.md` only after the user approves the content. Preserve unrelated sections and existing brand decisions.

### 3. Preview token changes

The brand utility reads the guide and existing token JSON:

```bash
node <skill-directory>/scripts/sync-brand-to-tokens.cjs --dry-run
```

Review the proposed palette names, base colors, generated shades, and semantic references. If required primary, secondary, or accent colors cannot be parsed, stop and correct the guide rather than guessing.

### 4. Synchronize only when explicitly requested

```bash
node <skill-directory>/scripts/sync-brand-to-tokens.cjs
```

The script should create timestamped backups of existing token JSON and CSS before writing. It should use the design-system generator located relative to this skill where available, not a Claude-specific path. If generation fails, restore the previous JSON and CSS and return a non-zero exit status.

Existing semantic status colors (success, warning, error, info) must remain unchanged unless the brand guide explicitly defines those semantic values. A primary, secondary, or accent brand color is not automatically a valid status color.

### 5. Verify

- Re-read the token JSON and ensure all references resolve.
- Run the design-system token validator/generator checks recommended by that skill.
- Compare the generated CSS with the intended token changes.
- Report backups, changed files, and test results.

## Ownership

- Brand owns the identity guide and brand decisions.
- Design-system owns token structure, validation, and token-to-CSS generation.
- UI styling owns application-specific styling implementation.

Do not use Claude-specific slash commands, `AskUserQuestion`, or `.claude/skills/` paths. In OpenCode, use normal conversation and the installed skill directory supplied by the runtime.
