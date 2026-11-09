# Create a Presentation

This guide is the execution workflow for the `slides` skill. It is not a command that invokes the skill again.

## 1. Understand the brief

Extract what is known from the user's request. Ask one concise clarification only if a missing detail would materially change the deck. Establish:

- Purpose: inform, persuade, teach, report, or pitch
- Audience and their prior knowledge
- Desired outcome or decision
- Approximate slide count or presentation duration
- Language, tone, brand constraints, and delivery format
- Available source material, data, citations, logos, and images

Do not invent company facts, market sizes, traction, testimonials, or numerical results. Use clearly marked placeholders where evidence is missing.

## 2. Plan the narrative

Choose a structure from `slide-strategies.md`. Common narrative arcs include:

- Pitch: context → problem → solution → market/opportunity → proof → business model → ask
- Sales: audience challenge → cost of status quo → proposed solution → evidence → offer → next step
- Report: executive summary → key findings → evidence → implications → recommendations
- Training: learning objectives → concepts → worked example → practice → recap

Create a slide outline before writing full copy. Each slide should have one main message and a clear role in the story. Remove slides that repeat the same message.

## 3. Select layouts and write copy

Use `layout-patterns.md` to vary visual structure according to content: title, split comparison, process, timeline, metric, quote, chart, image-led, or closing. Use copywriting formulas from `copywriting-formulas.md` selectively.

Guidelines:
- Write takeaway headlines rather than generic labels where possible.
- Keep one primary idea per slide.
- Use short supporting text and meaningful visual hierarchy.
- Cite data near the chart or statement it supports.
- Label illustrative or hypothetical examples as such.
- Never distort chart scales or imply causation from correlation.

## 4. Choose the implementation path

### Navigable HTML deck

Use `html-template.md` as the starting point when the user needs a presentation with one-slide-at-a-time navigation. Keep the navigation controls keyboard accessible, update the slide counter and progress indicator, and provide a visible focus state. Ensure the deck works without click-to-advance intercepting links or interactive chart controls.

### Token-based scroll deck helper

The optional `design-system/scripts/generate-slide.py` helper accepts a JSON deck and writes HTML. Before using it:

1. Resolve the actual installed `design-system` skill directory; do not guess a Claude-specific path.
2. Confirm the helper exists and inspect its `--help` output.
3. Confirm the repository contains the token assets expected by the helper (`assets/design-tokens.css`).
4. Explain that this helper creates vertically stacked, scrollable slides, not the navigable full-screen deck shown in `html-template.md`.
5. Use its default output location unless you have verified the token stylesheet path for a custom output location.

Do not run the helper if prerequisites are missing. Build the deck directly from the HTML template instead.

### Charts

Use a chart library already installed in the project when possible. Chart.js examples in the reference are optional; do not assume it is installed or that a CDN is reachable. If no chart library is available, use a simple accessible HTML/CSS visualization only when it represents the data accurately.

## 5. Apply design tokens responsibly

If the project has a design-token system, inspect the actual CSS/JSON files and reuse valid variables. The `design-system` skill owns token architecture and validation; this skill owns presentation-specific use of those tokens.

Never paste sample hex values or placeholder token names into a production deck while claiming full token compliance. If no token system exists, define a small, documented presentation palette or use the project's existing styles, and state that it is not connected to a shared token source.

## 6. Validate before delivery

When tools are available, inspect the rendered deck at desktop and mobile sizes. Verify:

- Every slide renders and the slide count is correct.
- Previous/next buttons, keyboard controls, progress, and counter work.
- Links and interactive charts remain usable.
- Text and visuals stay within slide safe areas.
- Contrast, focus indicators, chart labels, and reading order are accessible.
- No unsupported assets, broken image paths, missing fonts, or console errors remain.

If browser preview is unavailable, run static checks and clearly say that visual browser verification was not performed.

## 7. Deliver

Provide the deck path and a short summary of the narrative and format. State what was tested and list any remaining limitations or placeholders.
