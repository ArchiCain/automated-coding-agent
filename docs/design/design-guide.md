# Design Guide

Master design guide for the RTS AI Platform. This is the source of truth for all visual and interaction decisions.

## Design philosophy

- **Angular Material is the foundation** — use standard components. Don't build custom components when Material provides one.
- **No gradients** — flat, solid colors only.
- **No "AI aesthetic"** — no glow effects, particles, excessive blur, neon accents, or animated backgrounds.
- **Simple, clean, functional** — every visual element serves a purpose.
- **Let the framework do the work** — Angular Material handles accessibility, responsive behavior, and interaction patterns. Customize sparingly.

## Component library

**Angular Material** (Material Design 3) is the sole component library. All UI elements come from `@angular/material/*` modules.

When a design need arises:
1. First, check if Angular Material has a component for it
2. If yes, use it with standard configuration
3. If customization is needed, use the theming system (SCSS mixins), not CSS overrides
4. Only build a custom component if no Material component exists

## Theme system

The app supports **light mode** and **dark mode**. Themes are defined as Angular Material custom themes in SCSS.

- Theme files: `src/styles/themes/_light-theme.scss` and `_dark-theme.scss`
- Switching: A CSS class on `<body>` (`light-theme` or `dark-theme`) controls which theme is active
- User preference: Persisted via backend API, remembered across sessions
- Default: Dark mode

See also:
- [Color System](color-system.md)
- [Typography](typography.md)
- [Component Patterns](component-patterns.md)

## Layout

### App shell

```
+-------------------------------------------------------+
| App Header (sticky, full-width)                       |
|  [Menu] [App Name]                    [Theme] [Avatar]|
+--------+----------------------------------------------+
| Left   | Content Area                                 |
| Nav    |                                              |
| Side-  |   <router-outlet>                            |
| bar    |                                              |
|        |                                              |
| 280px  |   (fills remaining width)                    |
+--------+----------------------------------------------+
```

### Responsive behavior

| Breakpoint | Sidebar | Header menu |
|------------|---------|-------------|
| Desktop (1200px+) | Persistent, always visible | Hidden |
| Tablet (768-1199px) | Temporary drawer, triggered by menu button | Visible |
| Mobile (<768px) | Temporary drawer, triggered by menu button | Visible |

Breakpoints are managed via Angular CDK `BreakpointObserver`.

## Spacing

**Base unit: 8px** (Material Design standard).

Use multiples of the base unit for all spacing:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing (icon margins, inline elements) |
| `sm` | 8px | Default spacing (gaps between related items) |
| `md` | 16px | Content padding, card internal spacing |
| `lg` | 24px | Section spacing, card margins |
| `xl` | 32px | Page-level padding, major section breaks |
| `xxl` | 48px | Full-page layout spacing |

In SCSS, use Angular Material's `spacing()` mixin or direct `8px * n` calculations.

## Border radius

| Element | Radius | Why |
|---------|--------|-----|
| Buttons | 10px | Rounded but not pill-shaped |
| Cards | 12px | Slightly more rounded than buttons |
| Text fields | 10px | Match button radius |
| Chips | 8px | Compact elements, tighter radius |
| Icon buttons | 8px | Match chips |
| Dialogs | 12px | Match cards |

Default shape radius: `10px` (set in theme).

## Transitions

| Context | Duration | Easing |
|---------|----------|--------|
| Hover effects | 200ms | ease-in-out |
| Card hover lift | 300ms | ease-in-out |
| Focus states | 200ms | ease-in-out |
| Page transitions | 225ms (enter) / 195ms (leave) | standard |
| Complex animations | 375ms | standard |

## Shadows

Shadows are subtle and functional — they indicate elevation, not decoration.

- **Light mode**: Very subtle shadows (0.04-0.06 opacity)
- **Dark mode**: Slightly stronger shadows (0.12-0.2 opacity) for contrast
- Cards get a shadow lift on hover (elevation increase)
- Contained buttons have no resting shadow, gain shadow on hover

## Iconography

Use **Material Icons** exclusively (via `MatIconModule`). No custom icon sets, no emoji as icons.

| Usage | Size |
|-------|------|
| Inline text | 18px |
| Buttons | 20px |
| Navigation items | 24px (default) |
| Large/hero icons | 40px+ |

## Scrollbar styling (dark mode)

In dark mode, scrollbars are styled to match the dark background:
- Track: `#212121` (matches background)
- Thumb: `#404040` (subtle contrast)
- Thumb hover: `#505050`
- Width: 8px
- Border radius: 4px
