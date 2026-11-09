# Color Palette Management

Guidance for defining, documenting, extracting, and reviewing brand colors.

## Color System

- **Primary:** the main brand color for key actions and emphasis.
- **Secondary:** supporting brand colors.
- **Accent:** a limited highlight color.
- **Neutral:** backgrounds, text, borders, and surfaces.
- **Semantic:** success, warning, error, and informational states.

Semantic colors have meaning independent of the brand palette. Do not automatically map error to primary, info to secondary, or success to accent. Preserve existing semantic values unless the brand guide explicitly defines replacements and the user approves them.

## Documentation Format

```markdown
| Name | Hex | RGB | Usage |
|---|---|---|---|
| Ocean Blue | #2563EB | rgb(37,99,235) | CTAs and links |
```

Use valid six-digit hexadecimal values. Keep names and usage descriptions explicit.

## CSS Variables

```css
:root {
  --color-primary: #2563EB;
  --color-primary-light: #3B82F6;
  --color-primary-dark: #1D4ED8;
  --color-secondary: #8B5CF6;
  --color-accent: #10B981;
  --color-background: #FFFFFF;
  --color-surface: #F9FAFB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
}
```

## Tailwind Compatibility

First inspect the project's installed Tailwind major version. Do not mix v3 and v4 configuration styles.

### Tailwind CSS v4

Prefer CSS-first configuration:

```css
@import "tailwindcss";

@theme {
  --color-primary: #2563EB;
  --color-secondary: #8B5CF6;
  --color-accent: #10B981;
}
```

Use the project's existing CSS architecture and semantic variables. Use `@config` only when an existing legacy JavaScript config is intentionally retained and supported.

### Tailwind CSS v3

Use the existing `tailwind.config.js/ts` and extend its theme without replacing unrelated configuration:

```js
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: "#2563EB",
        500: "#3B82F6",
        600: "#2563EB",
        700: "#1D4ED8"
      }
    }
  }
}
```

Do not create a v3 config for a v4 project merely to apply brand colors.

## Accessibility

| WCAG level | Normal text | Large text | UI components |
|---|---:|---:|---:|
| AA | 4.5:1 | 3:1 | 3:1 |
| AAA | 7:1 | 4.5:1 | 4.5:1 |

Check actual foreground/background pairs with a contrast checker. A palette-level claim does not prove that every combination is accessible.

## Color Extraction

`extract-colors.cjs` parses documented hex values from brand-guide sections and can print a suggested ImageMagick command. It does not itself load image pixels, run k-means, or calculate a completed compliance report.

For actual image analysis, use ImageMagick or a suitable image-analysis tool, then compare the resulting colors with the palette. Treat RGB-distance matching as an approximation, not an accessibility or perceptual-color guarantee.

## Usage Guidance

- Use primary for key actions and important emphasis.
- Keep hover/active states consistent and documented.
- Test contrast for each real foreground/background pairing.
- Do not rely on color alone to communicate state.
- Avoid arbitrary off-palette colors; document justified exceptions.
