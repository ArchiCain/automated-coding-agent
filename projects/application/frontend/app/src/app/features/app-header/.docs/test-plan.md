# App Header — Test Plan

## AppHeaderComponent (Behavior)

- [ ] Renders a `mat-toolbar.app-header` with `position: sticky`, `top: 0`, and `z-index: 1100`.
- [ ] Toolbar has `background-color: var(--app-bg-paper)` and a `1px` bottom border of `var(--app-divider)`.
- [ ] Renders exactly one menu `mat-icon-button` as the first child, containing a `mat-icon` with text `menu` and `aria-label="Toggle navigation"`.
- [ ] Clicking the menu button emits `menuToggle` (assert via `component.menuToggle.subscribe` or a harness parent).
- [ ] Renders a `span.app-title` with text `AI Platform`.
- [ ] Renders `<app-theme-toggle>` before `<app-avatar-menu>` on the right side, with a `.spacer` element (`flex: 1`) between them and the title.
- [ ] Component declares `ChangeDetectionStrategy.OnPush`.

## AvatarMenuComponent (Behavior)

- [ ] Renders a `mat-icon-button` with `aria-label="User menu"` containing a `mat-icon` with text `account_circle`.
- [ ] Clicking the trigger opens the `mat-menu`.
- [ ] When `AuthService.user()` returns a non-null user, the menu renders a `.user-info` container containing a `.username` element showing the `username` value.
- [ ] When `AuthService.user()` returns `null`, no `.user-info` block is rendered and only the Sign Out item is present.
- [ ] The Sign Out `mat-menu-item` contains a `mat-icon` with text `logout` and a span with text `Sign Out`.
- [ ] Clicking Sign Out calls `AuthService.logout()` exactly once (spy on `AuthService.logout`).
- [ ] Component declares `ChangeDetectionStrategy.OnPush`.

## Integration

- [ ] When mounted inside `AppLayoutComponent`, clicking the menu button calls `LayoutService.toggleDrawer()` (spy on `LayoutService.toggleDrawer`).
- [ ] End-to-end: clicking Sign Out results in a `POST /auth/logout` request (`withCredentials: true`), the user signal becoming `null`, and navigation to `/login` — verified by checking that `authGuard` now blocks the previous route.

## Module

- [ ] `AppHeaderModule` imports and re-exports both `AppHeaderComponent` and `AvatarMenuComponent` (`app-header.module.ts:5-8`).
- [ ] Barrel `index.ts` re-exports `AppHeaderModule`, `AppHeaderComponent`, and `AvatarMenuComponent`.

## Accessibility

- [ ] Both icon-only buttons expose an `aria-label` (`Toggle navigation`, `User menu`).
- [ ] Template passes Angular's accessibility lint (`angular.configs.templateAccessibility`, `eslint.config.js:42`).
