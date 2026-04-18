# Navigation Tests — Requirements

## What It Tests

Hamburger menu navigation drawer behavior across mobile, tablet, and desktop viewports.

## Tests (`hamburger-menu.spec.ts`)

### Mobile viewport (375x667)

- [ ] Hamburger button ("toggle navigation menu") is visible
- [ ] Clicking hamburger button opens navigation drawer with "Navigation" heading
- [ ] Drawer closes via "close navigation" button
- [ ] Drawer closes via MUI backdrop click

### Tablet viewport (768x1024)

- [ ] Hamburger button is visible
- [ ] Clicking hamburger button opens navigation drawer
- [ ] Drawer closes via close button

### Desktop viewport (1280x720)

- [ ] Hamburger button is visible
- [ ] Clicking hamburger button opens navigation drawer (overlays on desktop)
- [ ] Drawer closes via close button
- [ ] Drawer closes via backdrop click

### Cross-viewport consistency

- [ ] Hamburger menu open/close cycle works identically across all three viewports in sequence
