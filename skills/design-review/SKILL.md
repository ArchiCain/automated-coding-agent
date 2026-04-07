# Skill: Design Review

You are operating as a **designer** agent. Your job is to ensure every UI matches
the design system, is accessible, and looks correct at all breakpoints. You review
code, capture screenshots, and file issues for violations.

---

## Design System Rules

### Spacing

| Context | Value | Implementation |
|---------|-------|----------------|
| Page margins (desktop) | 24px | `theme.spacing(3)` |
| Page margins (mobile) | 16px | `theme.spacing(2)` |
| Card internal padding | 16px | `theme.spacing(2)` |
| Between sections | 32px | `theme.spacing(4)` |
| Between related elements | 8px | `theme.spacing(1)` |
| Between form fields | 16px | `theme.spacing(2)` |
| Button internal padding | 8px 16px | Use MUI defaults |

Rules:
- **Always** use `theme.spacing()`. Never hardcode pixel values for spacing.
- Consistent spacing within a view. If cards use 16px padding, all cards use 16px padding.
- Sections within a page are separated by 32px. Never less than 24px, never more than 48px.

### Typography

| Usage | Variant | Element |
|-------|---------|---------|
| Page title | `h4` | `<Typography variant="h4">` |
| Section heading | `h6` | `<Typography variant="h6">` |
| Body text | `body1` | `<Typography variant="body1">` |
| Secondary text | `body2` | `<Typography variant="body2">` |
| Captions / metadata | `caption` | `<Typography variant="caption">` |
| Data grid cells | `body2` | Default MUI DataGrid |

Rules:
- Maximum **3 font sizes** per view. If you need a 4th, reconsider the hierarchy.
- All typography uses `theme.typography.*` variants. No inline `fontSize` or `fontWeight`.
- Line height: use MUI defaults. Do not override line height.
- Truncation: if text may overflow, use CSS `text-overflow: ellipsis` AND provide a tooltip.

### Colors

| Usage | Token | Example |
|-------|-------|---------|
| Primary actions | `primary` | Save, Submit, Create buttons |
| Destructive actions | `error` | Delete, Remove buttons |
| Success states | `success` | Completed, Active indicators |
| Warning states | `warning` | Pending, Expiring indicators |
| Informational | `info` | Help text, tooltips |
| Backgrounds | `background.default`, `background.paper` | Page bg, card bg |

Rules:
- Maximum **2 background colors** per view (`default` and `paper`).
- **WCAG AA contrast** required: 4.5:1 for normal text, 3:1 for large text.
- **No hardcoded colors** in component files. Use `theme.palette.*` exclusively.
- Status colors must be semantic: green=success, red=error, amber=warning, blue=info.
- Do not use color as the sole indicator of state (accessibility requirement).

### Layout

| Rule | Value |
|------|-------|
| Max content width | 1200px |
| Content centering | `margin: 0 auto` |
| Card heights | Consistent within a row/grid |
| Form label position | Above the input |
| Number alignment | Right-aligned in tables/grids |
| Action buttons | Right-aligned in forms, bottom of cards |

Rules:
- Content never exceeds 1200px width. Use `maxWidth: 1200` with auto margins.
- Cards in the same grid row must have the same height (use CSS Grid or MUI Grid with `stretch`).
- Labels always above inputs, never inline (exception: compact filter bars).
- Numbers are right-aligned in tables and data grids.
- Primary action is rightmost in button groups.

### Components

| Need | Component | Notes |
|------|-----------|-------|
| Data lists | `DataGrid` | MUI X DataGrid, not custom tables |
| Text input | `TextField` | Always controlled (value + onChange) |
| Navigation | `AppBar` + `Drawer` | Consistent app shell |
| Modals | `Dialog` | Max width 600px, max height 80vh |
| Loading states | `Skeleton` | Never spinners. Skeleton shapes match content. |
| Notifications | `Snackbar` | Bottom-left position, auto-dismiss 5s |
| Selection | `Select` or `Autocomplete` | Autocomplete for >10 options |
| Dates | `DatePicker` | MUI X DatePicker, localized format |
| Confirmation | `Dialog` | Destructive actions require confirmation dialog |

Rules:
- Use MUI components for everything. No raw `<table>`, `<select>`, `<input>`.
- All `TextField` components must be **controlled** (no uncontrolled inputs).
- Modals max width 600px. If content needs more, reconsider the design.
- Skeleton placeholders must match the shape of the content they replace.
- Toast/snackbar position: bottom-left, always.

---

## Things That Are Always Wrong

If you see any of these, file an issue immediately:

1. **Horizontal scrolling** on any viewport (except data grids with many columns).
2. **Text truncation without tooltip** — truncated text must have a title or Tooltip.
3. **Clickable elements smaller than 44x44 CSS pixels** — minimum touch target size.
4. **Missing focus indicators** — interactive elements must have visible focus rings.
5. **Color-only state indicators** — must also have icon, text, or pattern.
6. **Unlabeled icons** — icon buttons must have `aria-label` or accompanying text.
7. **Missing alt text** on images.
8. **Form fields without labels** — every input needs a visible or `aria-label` label.
9. **Inconsistent border radius** within the same view.
10. **Mixed spacing values** — e.g., some cards with 16px padding and others with 24px.
11. **Orphaned headings** — a heading with no content below it.
12. **Disabled buttons without explanation** — disabled state must be explained via tooltip.
13. **Auto-playing animations** without user control.
14. **Z-index wars** — stacking contexts must be managed through MUI's theme, not arbitrary values.

---

## Review Process

### Step 1 — Code-Level Review

Check the source code for violations:

```bash
# Find hardcoded colors
grep -rn '#[0-9a-fA-F]\{3,8\}' --include='*.tsx' --include='*.ts' src/
grep -rn 'rgb\|rgba' --include='*.tsx' --include='*.ts' src/

# Find hardcoded spacing
grep -rn 'padding:\s*[0-9]' --include='*.tsx' src/
grep -rn 'margin:\s*[0-9]' --include='*.tsx' src/

# Find raw HTML where MUI should be used
grep -rn '<table\|<select\|<input' --include='*.tsx' src/

# Find uncontrolled inputs
grep -rn 'defaultValue' --include='*.tsx' src/

# Find missing test IDs on interactive elements
grep -rn '<Button\|<IconButton' --include='*.tsx' src/ | grep -v 'data-testid'
```

### Step 2 — Screenshot Capture

Capture screenshots at three breakpoints:

| Breakpoint | Dimensions | Name |
|-----------|------------|------|
| Mobile | 375 x 812 | `mobile` |
| Tablet | 768 x 1024 | `tablet` |
| Desktop | 1440 x 900 | `desktop` |

```typescript
const breakpoints = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const bp of breakpoints) {
  await page.setViewportSize({ width: bp.width, height: bp.height });
  await page.goto(pageUrl);
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: `screenshots/review/${viewName}-${bp.name}.png`,
    fullPage: true,
  });
}
```

### Step 3 — Visual Review

For each screenshot, check:
- [ ] Content within 1200px max width
- [ ] No horizontal scrolling
- [ ] Consistent spacing between elements
- [ ] Typography hierarchy is clear (max 3 sizes)
- [ ] Cards have consistent heights
- [ ] Responsive layout works (no overlapping, no overflow)

### Step 4 — UI State Coverage

Every view must be screenshotted in all meaningful states:
- **Empty state** — No data, shows helpful message or illustration
- **Loading state** — Skeleton placeholders visible
- **Populated state** — Normal data display
- **Error state** — Error message visible, retry action available
- **Edge cases** — Very long text, many items, single item

### Step 5 — Accessibility Audit

```typescript
// Run axe accessibility checks via Playwright
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .analyze();

expect(results.violations).toEqual([]);
```

Also manually verify:
- [ ] Tab order is logical
- [ ] All interactive elements are keyboard accessible
- [ ] Focus is visible on all interactive elements
- [ ] Screen reader landmarks are present (main, nav, aside)
- [ ] Color contrast passes WCAG AA (4.5:1 for text)
- [ ] No content is conveyed by color alone
