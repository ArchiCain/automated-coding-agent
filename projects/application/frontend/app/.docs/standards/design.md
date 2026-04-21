# Design Specification

Derived from `src/styles.scss`, `src/app/features/theme/styles/_light-theme.scss`, `_dark-theme.scss`, and the actual component templates. All claims here trace to those files.

## Philosophy

Angular Material 21 with `mat.theme()` (M3 API) as the foundation. Custom look is driven through CSS custom properties (`--app-*`) defined per theme class on `:root`. A short list of global Material overrides (rounded corners, hover lift) lives in `src/styles.scss`. No gradients, no custom component library.

## Themes

Two theme classes on the `<html>` element, toggled by `ThemeService.applyTheme()` (`features/theme/services/theme.service.ts:32-36`): `light-theme` (default) and `dark-theme`. The preference is persisted server-side via `GET /theme` / `PUT /theme` (`theme.service.ts:39-53`).

Material palette configuration (`features/theme/styles/_light-theme.scss:7-15`, `_dark-theme.scss:7-15`):

| Theme | Primary palette | Tertiary palette | Theme type |
|---|---|---|---|
| Light | `mat.$blue-palette` | `mat.$green-palette` | `light` |
| Dark | `mat.$azure-palette` | `mat.$green-palette` | `dark` |

Wired in `src/styles.scss:5-15` via `@include mat.theme(light.$light-theme)` on `html`, overridden by `html.dark-theme { @include mat.theme(dark.$dark-theme) }`.

## CSS Custom Properties

These are the variables components should reach for. Defined per theme class.

### Backgrounds

| Token | Light | Dark |
|---|---|---|
| `--app-bg-default` | `#ffffff` | `#212121` |
| `--app-bg-paper` | `#ffffff` | `#2a2a2a` |
| `--app-bg-chat-user` | `#f3f6f9` | `#343434` |
| `--app-bg-chat-assistant` | `#ffffff` | `#2a2a2a` |

### Text

| Token | Light | Dark |
|---|---|---|
| `--app-text-primary` | `#1a2027` | `#e7ebf0` |
| `--app-text-secondary` | `#3e5060` | `#b2bac2` |

### Primary accent

| Token | Light | Dark |
|---|---|---|
| `--app-primary` | `#007fff` | `#ececec` |
| `--app-primary-light` | `#66b2ff` | `#ffffff` |
| `--app-primary-dark` | `#0059b2` | `#b4b4b4` |

### Semantic

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--app-success` | `#1aa251` | `#1db45a` | healthy, up |
| `--app-warning` | `#dea500` | `#e9ab13` | degraded |
| `--app-error` | `#eb0014` | `#ff4c4f` | errors, destructive |

### Borders & interaction

| Token | Light | Dark |
|---|---|---|
| `--app-divider` | `rgba(194,224,255,0.08)` | `rgba(194,224,255,0.08)` |
| `--app-border-subtle` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` |
| `--app-hover-overlay` | `rgba(0,127,255,0.08)` | `rgba(51,153,255,0.08)` |
| `--app-hover-shadow` | `0 4px 12px rgba(51,153,255,0.3)` | (same) |
| `--app-focus-ring` | `#3399ff` | `#3399ff` |

### Dark-only scrollbar

`--app-scrollbar-track: #212121`, `--app-scrollbar-thumb: #404040`, `--app-scrollbar-thumb-hover: #505050` (`_dark-theme.scss:48-52`). Applied via `scrollbar-width: thin; scrollbar-color: ...` and `::-webkit-scrollbar` rules (`styles.scss:27-51`). Light mode uses the browser default.

## Global Material overrides

From `src/styles.scss:54-102`. These apply app-wide — do not re-override per component:

- **Buttons** (`.mat-mdc-button, .mat-mdc-raised-button, .mat-mdc-flat-button, .mat-mdc-outlined-button`): `border-radius: 10px`, `font-weight: 700`, `text-transform: none`, `letter-spacing: 0.02em`, hover lifts `translateY(-1px)`.
- **Cards** (`.mat-mdc-card`): `border-radius: 12px`, hover lifts `translateY(-2px)` with a 300ms transition.
- **Icon buttons** (`.mat-mdc-icon-button`): `border-radius: 8px`, hover uses `--app-hover-overlay` and `scale(1.05)`.
- **Chips** (`.mat-mdc-chip`): `border-radius: 8px`, `font-weight: 600`.
- **Form fields**: outlined notch segments get `border-radius: 10px` (`styles.scss:98-102`).

## Typography

- Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif, ...emoji fonts` (`styles.scss:22-23`). Roboto 300/400/500 is preloaded via Google Fonts in `index.html:12-14`.
- Icon font: Material Icons (`index.html:15`).
- Page title weight: `600` at `1.1rem` for the toolbar app title (`app-header.component.ts:32-36`).
- Use Material Typography classes (`mat-headline-5`, `mat-headline-6`, `mat-body-1`, `mat-caption`) rather than custom sizes.

## Layout

### Authenticated shell

`AppLayoutComponent` (`features/layouts/components/app-layout/app-layout.component.html`):

```
┌──────────────────────────────────────────────┐
│ app-header (sticky, z-index: 1100)           │
├──────────────┬───────────────────────────────┤
│ sidenav 280 │ mat-sidenav-content           │
│ (side mode  │  <router-outlet />            │
│  on desktop,│                               │
│  over mode  │                               │
│  <1200px)   │                               │
└──────────────┴───────────────────────────────┘
```

Breakpoints (`features/layouts/services/layout.service.ts:5-9`):

| Name | Range |
|---|---|
| Desktop | `min-width: 1200px` |
| Tablet | `768px – 1199px` |
| Mobile | `max-width: 767px` |

`LayoutService.showPersistentSidebar` is true only on desktop. On tablet/mobile the sidenav is an overlay drawer controlled by `toggleDrawer()` from the header menu button.

Left sidebar width: `280px` (`features/navigation/components/left-navigation-sidebar/left-navigation-sidebar.component.ts:17`). Header is `sticky; top: 0; z-index: 1100` with a bottom divider.

### Login page

Centered card with max-width `440px`, `padding: 32px`, `border-radius: 12px`, 600 ms slide-up-fade-in animation (`features/keycloak-auth/pages/login.page.ts:27-62`). Animation is disabled via `@media (prefers-reduced-motion: reduce)`.

## Component Patterns

### Buttons

| Use | Component |
|---|---|
| Primary action | `mat-flat-button` (default color) |
| Secondary / cancel | `mat-button` |
| Icon-only | `mat-icon-button` |
| Destructive | `mat-flat-button color="warn"` (see `ConfirmationModalComponent`) |

### Form fields

```html
<mat-form-field appearance="outline">
  <mat-label>Search users</mat-label>
  <input matInput ... />
  <mat-icon matSuffix>search</mat-icon>
</mat-form-field>
```

`appearance="outline"` is the project default (`users.page.ts:29`). Never set a custom `border-radius` on `mat-form-field` — the global 10px on the notch is already set in `styles.scss:98-102`.

### Dialogs

Opened via `MatDialog.open(Component, { data: { ... } })`. Generic destructive confirm: `ConfirmationModalComponent` in `@features/shared` — returns `true` on confirm, `false` on cancel (`features/shared/components/confirmation-modal/confirmation-modal.component.ts`).

### Navigation tree

`NavigationTreeComponent` renders `navigationConfig.items` as `mat-nav-list`. Items with `children` become `mat-expansion-panel` groups. The active route gets `active-link` class: `background-color: var(--app-hover-overlay); font-weight: 600` (`features/navigation/components/navigation-tree/navigation-tree.component.ts:57-60`).

### Theme toggle

`mat-icon-button` swapping between the `light_mode` and `dark_mode` Material icons based on `ThemeService.isDark()` (`features/theme/components/theme-toggle/theme-toggle.component.ts:11-13`).

### Chat surface

- `chat-page` occupies the full layout viewport minus the 64px toolbar, with `margin: -24px` to neutralize the default content padding (`features/chat/pages/chat.page.ts:36-40`).
- User vs assistant bubbles use `--app-bg-chat-user` / `--app-bg-chat-assistant`.

## Accessibility

- `mat-icon-button`s carry `aria-label` (`app-header.component.ts:16`, `theme-toggle.component.ts:11`).
- Respect `prefers-reduced-motion` for any new animations (`login.page.ts:44-48`).
- Templates are linted with `angular.configs.templateAccessibility` (`eslint.config.js:42`).

## Spacing

Multiples of 8px. Page padding defaults to 24px (observed `margin-bottom: 24px` on page headers, `gap: 24px` on the smoke-tests grid, `padding: 32px` on the login card). Prefer 4 / 8 / 16 / 24 / 32 px rather than introducing new values.

## What NOT to do

1. Do not hardcode colors — use the `--app-*` tokens so both themes work.
2. Do not re-override global Material radii/hover effects already set in `styles.scss`.
3. Avoid `::ng-deep` — the `--app-*` tokens and Material theming should cover nearly every case.
4. Do not set `border-radius` on `mat-form-field` inner segments — the global rule handles it.
5. Do not add animations without a `prefers-reduced-motion` escape.
