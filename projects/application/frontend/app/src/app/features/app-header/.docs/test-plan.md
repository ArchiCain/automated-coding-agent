# App Header — Test Plan

## AppHeaderComponent

- [ ] Toolbar is sticky at top with `z-index: 1100`
- [ ] Menu button emits `menuToggle` event on click
- [ ] App title displays "RTS AI Platform"
- [ ] Theme toggle renders in the right side of the toolbar
- [ ] Avatar menu renders in the right side of the toolbar
- [ ] Uses `ChangeDetectionStrategy.OnPush`

## AvatarMenuComponent

- [ ] Shows current username from `AuthService.user()` when signed in
- [ ] Icon button opens `mat-menu`
- [ ] "Sign Out" menu item calls `AuthService.logout()`
- [ ] Uses `ChangeDetectionStrategy.OnPush`
