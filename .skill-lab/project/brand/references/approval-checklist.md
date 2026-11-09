# Asset Approval Checklist

Use this checklist for human review before publishing or approving a brand asset. Automated checks are advisory and do not replace visual, accessibility, licensing, or legal review.

## Quick Review
- [ ] Asset serves the stated purpose and audience.
- [ ] No obvious content, layout, or rendering defects.
- [ ] Aligns with the campaign goal and approved brief.

## Visual Elements

### Logo
- [ ] Correct approved logo variant.
- [ ] Clear space and minimum size respected.
- [ ] Colors and proportions are unmodified.
- [ ] Logo remains legible against its background.

### Color
- [ ] Brand palette is applied consistently.
- [ ] Semantic colors retain their intended meaning.
- [ ] Contrast is sufficient.
- [ ] Any intentional off-palette colors have a documented reason.

### Typography
- [ ] Approved typefaces and weights are used.
- [ ] Hierarchy, sizes, and line heights suit the medium.
- [ ] Text remains readable at the final display size.

### Imagery
- [ ] Photography/illustration matches the brand direction.
- [ ] Image quality and crop suit the placement.
- [ ] Licensing, attribution, and usage rights are confirmed.

## Accessibility
- [ ] Normal text contrast is at least 4.5:1 (WCAG AA).
- [ ] Large text contrast is at least 3:1.
- [ ] Color is not the only carrier of meaning.
- [ ] Focus states and meaningful alternative text are present where applicable.
- [ ] Reading order and headings are logical.

## Content
- [ ] Voice and tone match the brand guide.
- [ ] Claims are accurate and substantiated.
- [ ] CTA and value proposition are clear.
- [ ] Copy is proofread and appropriate for the audience.

## Technical Review
- [ ] File format is suitable for the destination.
- [ ] Resolution/dimensions were checked with an image or media inspection tool.
- [ ] File size is suitable for the destination.
- [ ] Filename follows the agreed convention.
- [ ] Metadata and manifest entry are correct where required.

## Platform Review
| Platform | Verified |
|---|---|
| Instagram | [ ] Placement dimensions and safe areas |
| X | [ ] Placement requirements |
| LinkedIn | [ ] Placement requirements |
| Facebook | [ ] Placement requirements |
| Email | [ ] Size and rendering |
| Web | [ ] Responsive rendering and optimization |

## Legal and Compliance
- [ ] Stock media is licensed for the intended use.
- [ ] Trademarks and user-provided content are authorized.
- [ ] Required disclosures are present.
- [ ] Pricing, terms, and privacy statements are accurate.

## Sign-off
| Review Area | Reviewer | Date | Status |
|---|---|---|---|
| Visual design | | | [ ] Pass / [ ] Revisions |
| Copy/content | | | [ ] Pass / [ ] Revisions |
| Brand consistency | | | [ ] Pass / [ ] Revisions |
| Technical | | | [ ] Pass / [ ] Revisions |
| Legal | | | [ ] Pass / [ ] Revisions |

**Approved by:** __________________

**Date:** __________________

**Version:** __________________

## Automation Support

`validate-asset.cjs` currently checks filename convention, supported extension, file size, and optional manifest registration. It does **not** inspect image dimensions, image pixels, color-palette compliance, licensing, or general metadata. Use appropriate media/visual inspection tools for those checks.

Run from the project root:

```bash
node <skill-directory>/scripts/validate-asset.cjs <asset-path> --json
```

## Archival

After approval, follow the project's asset-management process to update the manifest, record reviewer and timestamp, and archive superseded versions. Do not move or delete prior assets without explicit approval.
