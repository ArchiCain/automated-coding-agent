# Shared — Test Plan

## ConfirmationModalComponent

- [ ] Modal displays title from `ConfirmationModalData.title`
- [ ] Modal displays message from `ConfirmationModalData.message`
- [ ] Confirm button uses `color="warn"` and `mat-flat-button`
- [ ] Cancel button uses default `mat-button` style
- [ ] `confirmText` defaults to "Confirm" when not provided
- [ ] `cancelText` defaults to "Cancel" when not provided
- [ ] Custom `confirmText` and `cancelText` override defaults
- [ ] Dialog closes with `true` on confirm click
- [ ] Dialog closes with `false` on cancel click
- [ ] Uses `ChangeDetectionStrategy.OnPush`
