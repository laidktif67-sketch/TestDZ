---
name: banner-design
description: "Plan and create banners, covers, headers, ad creatives, website hero visuals, and print banner layouts. Owns banner-specific requirements, art direction, composition, sizing, export guidance, and review. Activate for banner or cover requests; delegates brand, design-token, and general UI implementation concerns to their specialist skills when available."
argument-hint: "[platform] [purpose] [style]"
license: MIT
metadata:
  author: claudekit
  version: "1.1.0"
---

# Banner Design

A focused workflow for planning, designing, reviewing, and preparing banners for social platforms, advertising, websites, events, and print. This skill owns banner-specific creative direction and deliverables. It does not own full website implementation, brand strategy, general UI styling, slide decks, or video editing.

## When to Activate

- Social media covers, headers, profile banners, and campaign graphics
- Display ads and promotional creatives
- Website hero and section banners
- Event, trade-show, and print banners
- Resizing or adapting an existing banner for multiple placements

## Ownership and Skill Routing

- Use `brand` for approved brand identity, voice, and brand assets when that skill is available.
- Use `design-system` only when token definitions or component specifications are needed.
- Use `ui-styling` for broader application styling or Tailwind implementation.
- Use `design` for logo, corporate identity, icon, or social-photo work that is not specifically a banner.
- Do not duplicate these skills' workflows. If a named specialist is unavailable, continue with the relevant information already provided and state any limitation.

## Workflow

### 1. Clarify the brief

Ask only for information that is missing and materially affects the result. Establish:
- Purpose and placement (cover, ad, website hero, print, etc.)
- Platform or exact output dimensions
- Main message, supporting copy, and desired call to action
- Brand assets, colors, typography, and any supplied guidelines
- Audience, tone, visual direction, and number of concepts

Do not make the user repeat details already supplied. If a detail is nonessential, choose a sensible default and state it.

### 2. Confirm the format and constraints

1. Consult `references/banner-sizes-and-styles.md` for starting-point dimensions and art directions.
2. Treat platform dimensions and safe areas as guidance, not immutable facts. Verify current official platform specifications when exact delivery compliance matters.
3. Confirm whether the output is a raster image, editable HTML/CSS, SVG, or print-ready artwork.
4. For print, obtain the printer's required trim size, bleed, color profile, and resolution before claiming the file is production-ready.

### 3. Develop art direction

Create one to three distinct concepts when useful. For each, define:
- Composition and focal point
- Background or imagery approach
- Color and typography direction
- Text hierarchy and placement
- CTA treatment, if required
- Crop behavior and safe areas across target placements

Keep essential text and logos away from likely crop or interface-overlay zones. Do not apply one universal safe-area percentage to every platform; use the actual placement's guidance.

### 4. Create the banner

Choose a creation route based on tools actually available in the current environment:
- **Image generation available:** generate the visual asset with a clear composition, aspect ratio, brand palette, and reserved space for copy when needed. Add precise typography and logos in a suitable layout/editing step where possible.
- **HTML/CSS or browser tooling available:** build a responsive or fixed-size composition and render it at the exact requested dimensions.
- **Neither available:** provide a production-ready design specification, layout, copy, and generation prompt rather than claiming an image or export was created.

Do not assume optional skills, browser automation, Gemini scripts, Chrome, Playwright, or third-party APIs are installed. Check availability before invoking them. Never expose API keys or ask the user to paste secrets into source files.

### 5. Review and export

Check the result against the brief:
- Correct dimensions and aspect ratio
- Readable hierarchy at the intended display size
- Sufficient text/background contrast
- Correct spelling, logo, and brand colors
- No clipped text or important elements
- Appropriate safe areas and crop behavior
- Correct file format and reasonable file size

Export only through a tool that is actually available. Name files descriptively using kebab-case and dimensions, for example `campaign-summer-cover-820x312.png`. Keep variants grouped in a campaign folder when file operations are available.

For print, label the output as a preview unless the requested bleed, color profile, resolution, and printer specifications have been verified.

### 6. Present and iterate

Present each available concept with its purpose, dimensions, rationale, and limitations. Distinguish clearly between a generated image, an editable source/layout, a preview, and a verified final export. Ask for feedback on a specific design decision and revise only the requested aspects. Do not claim files were saved or exported unless the tool confirms it.

## Quality Rules

- Use a clear focal point and intentional visual hierarchy.
- Keep copy concise and avoid adding unrequested claims, prices, or offers.
- Use brand-approved assets and colors when supplied; do not invent a logo.
- Limit typefaces and visual effects to what supports the message.
- Ensure legibility and contrast; use WCAG contrast guidance for text where applicable.
- Use one primary CTA unless the brief requires otherwise.
- Do not assume a universal "20% text" advertising rule; follow current platform and campaign requirements.
- Avoid fabricated performance claims such as "highest CTR" or guaranteed ad approval.

## Reference

Use `references/banner-sizes-and-styles.md` for the maintained size and art-direction reference. Verify changeable platform requirements against official documentation before final production.
