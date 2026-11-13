# Proposed token changes — Wave 1

Source of truth: `apps/web/src/styles/tokens.css`. Proposals only; no source token file changed.

| Proposed token | Value | Contrast on white | Reason |
|---|---|---:|---|
| `--color-success-text` | `#087a50` | 5.37:1 | Existing `--color-accent #08a879` is about 3.05:1, insufficient for normal text. |
| `--color-warning-text` | `#b45309` | 5.02:1 | New semantic warning foreground; no central warning token exists. |
| `--color-danger-text` | `#b42318` | 6.57:1 | Existing `--color-danger #dc4545` is about 4.22:1, below 4.5:1. |
| `--color-info-text` | `#1758b8` | 6.72:1 | Distinct informational foreground from existing blue family. |
| `--color-success-soft` | `#e8f5ee` | — | Proposed semantic background; recheck foreground/border pairing. |
| `--color-warning-soft` | `#fff4e5` | — | Proposed semantic background. |
| `--color-danger-soft` | `#fff0ef` | — | Proposed semantic background. |
| `--color-info-soft` | `#e8f0ff` | — | Reuse existing primary-soft family. |
| `--control-min-height` | `44px` | — | Current feature controls include targets below 44px. |

WCAG relative luminance formula: (lighter + 0.05) / (darker + 0.05). Normal text threshold: 4.5:1. Existing checks: text #071b50 = 16.39:1; muted #526486 = 5.96:1; soft #7183a2 = 3.84:1; primary #075cf5 = 5.44:1. Do not use text-soft, accent, or current danger as normal-size text on white.
