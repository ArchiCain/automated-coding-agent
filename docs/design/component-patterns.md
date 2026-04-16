# Component Patterns

Angular Material component customization patterns. These define how standard Material components are styled in this application.

## Buttons (MatButton)

| Property | Value |
|----------|-------|
| Border radius | 10px |
| Padding | 10px 20px |
| Font weight | 700 |
| Text transform | none (no uppercase) |
| Hover effect | translateY(-1px) + shadow |
| Hover shadow | `0 4px 12px rgba(51, 153, 255, 0.3)` |
| Transition | all 0.2s ease-in-out |
| Contained variant | No resting shadow, gains shadow on hover |

```scss
// In theme customization
mat-button {
  border-radius: 10px;
  padding: 10px 20px;
  font-weight: 700;
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(51, 153, 255, 0.3);
  }
}
```

## Cards (MatCard)

| Property | Value |
|----------|-------|
| Border radius | 12px |
| Background image | none (removes default gradient overlay) |
| Hover effect | translateY(-2px) |
| Hover shadow | `0 12px 24px rgba(0, 0, 0, 0.4)` (dark mode) |
| Transition | all 0.3s ease-in-out |

Cards lift slightly on hover to indicate interactivity. Non-interactive cards should not have hover effects.

## Paper / Surfaces (MatCard, MatDialog, etc.)

| Elevation | Shadow |
|-----------|--------|
| 1 | `0 2px 8px rgba(0, 0, 0, 0.25)` |
| 2 | `0 4px 12px rgba(0, 0, 0, 0.3)` |
| 3 | `0 8px 24px rgba(0, 0, 0, 0.35)` |

No `backgroundImage` on any Paper/surface element — removed to prevent MUI-style gradient overlays.

## Text fields (MatFormField)

| Property | Value |
|----------|-------|
| Variant | Outlined |
| Border radius | 10px |
| Focus border color | `#3399FF` |
| Focus border width | 2px |
| Hover border color | `#3399FF` |
| Transition | all 0.2s ease-in-out |

## App bar (MatToolbar)

| Property | Value |
|----------|-------|
| Background image | none |
| Box shadow | none (uses bottom border instead) |
| Bottom border | `1px solid rgba(194, 224, 255, 0.08)` |
| Position | sticky, top: 0, z-index: 1100 |

The app bar uses a subtle border instead of a shadow for a cleaner look.

## Drawer / Sidebar (MatSidenav)

| Property | Value |
|----------|-------|
| Background image | none |
| Right border | `1px solid rgba(194, 224, 255, 0.08)` |
| Width | 280px (desktop persistent) |

## Icon buttons (MatIconButton)

| Property | Value |
|----------|-------|
| Border radius | 8px |
| Hover background | `rgba(51, 153, 255, 0.08)` |
| Hover scale | 1.05 |
| Transition | all 0.2s ease-in-out |

## Chips (MatChip)

| Property | Value |
|----------|-------|
| Border radius | 8px |
| Font weight | 600 |

## Tables (MatTable)

| Property | Value |
|----------|-------|
| Header background | Slightly elevated from paper |
| Row hover | Subtle background change |
| Sorting icons | Default Material behavior |
| Pagination | MatPaginator below table |

## Dialogs (MatDialog)

| Property | Value |
|----------|-------|
| Border radius | 12px |
| Max width | 400px (confirmations), 600px (forms) |
| Backdrop | Default Material backdrop |

## Implementation in Angular Material

These customizations are applied through the Angular Material theming system in `src/styles/themes/`:

1. **Global overrides**: Component-level customizations in the theme SCSS files using `mat.define-theme()` and component-specific mixins
2. **CSS custom properties**: For values that need to be accessible in component-scoped styles
3. **Component SCSS**: For feature-specific styling that doesn't belong in the global theme

Avoid using `!important` or deeply nested CSS selectors to override Material styles. If a customization requires force-overriding Material internals, reconsider whether it aligns with Material Design principles.
