# Visual Acceptance

**Contract state:** UX_CONTRACT_READY

## Phone viewport checks

- Verify at 320×568, 390×844, and 430×932 CSS pixels.
- No horizontal scrolling, clipped tab labels, or map controls hidden behind safe areas/sheets.
- The map remains the dominant surface on Map; non-map pages use readable single-column Ionic layouts.
- Route and direction names wrap gracefully at 200% text scaling.

## Interaction checks

- Every icon-only control has an accessible label and at least a 44×44 px hit target.
- Focus order follows visual order and remains visible for keyboard/switch input.
- Native back dismisses modal/sheet before changing page.
- Loading skeletons do not cause major layout jumps.
- Offline/error states retain one clear primary recovery action.

## Map checks

- Attribution is visible at every sheet breakpoint.
- Search, recenter, and sheet controls never overlap each other.
- Selected route line is distinguishable without color alone through width/outline and route label context.
- Fit-to-route accounts for header, tabs, and the current sheet breakpoint.
- Style load failure does not render a blank unexplained surface.

## Style rejection checks

- No decorative gradients or glassmorphism.
- No oversized dashboard cards, fake analytics, ornamental charts, or unnecessary floating buttons.
- No copied Sakay.ph brand marks, artwork, screenshots, route data, or proprietary layout reproduction.
- No live badge, ETA, fare, schedule, stop sequence, or vehicle count without an approved data source.

## Evidence required before review

- Screenshots for Map loading/ready/style error, route list loading/empty/error/content, direction selection, location denied, offline, and narrow/large phone widths.
- Automated accessibility scan where supported plus manual labels/focus/back review.
- Contrast verification for interface tokens and representative Admin route colors with their text/outline treatment.
