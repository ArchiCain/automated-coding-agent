# Navigation Tests — Requirements

## What It Tests

Hamburger menu navigation drawer behavior across mobile, tablet, and desktop viewports. All tests authenticate first (login as admin), then verify the drawer open/close mechanics at each breakpoint.

## Test File

`hamburger-menu.spec.ts`

## Viewports Tested

| Name | Width | Height |
|------|-------|--------|
| Mobile | 375px | 667px |
| Tablet | 768px | 1024px |
| Desktop | 1280px | 720px |

## Tests

### Mobile viewport (375x667)

- [ ] Hamburger button (aria-label "toggle navigation menu") is visible
- [ ] Clicking hamburger button opens navigation drawer with "Navigation" heading
- [ ] Drawer closes via "close navigation" button — heading becomes hidden
- [ ] Drawer closes via MUI backdrop (`.MuiBackdrop-root`) click

### Tablet viewport (768x1024)

- [ ] Hamburger button is visible
- [ ] Clicking hamburger button opens navigation drawer with "Navigation" heading
- [ ] Drawer closes via "close navigation" button

### Desktop viewport (1280x720)

- [ ] Hamburger button is visible (overlays rather than persistent sidebar)
- [ ] Clicking hamburger button opens navigation drawer with "Navigation" heading
- [ ] Drawer closes via "close navigation" button
- [ ] Drawer closes via MUI backdrop click

### Cross-viewport consistency

- [ ] Sequential open/close cycle works identically across mobile, tablet, and desktop in a single test run (iterates all viewports via `page.setViewportSize`)

## Implementation Notes

- Tests use `test.use({ viewport })` per describe block for viewport-specific suites
- The cross-viewport test sets viewport dynamically with `page.setViewportSize`
- Drawer detection uses role-based selector: `getByRole('heading', { name: /navigation/i })`
- Close button uses: `getByRole('button', { name: /close navigation/i })`
- Backdrop uses MUI class selector: `.MuiBackdrop-root` with `force: true` click
