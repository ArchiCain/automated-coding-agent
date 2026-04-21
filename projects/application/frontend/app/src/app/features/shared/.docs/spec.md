# Shared — Requirements

**Feature directory:** `src/app/features/shared/`

## What It Does

Reusable UI components used across multiple features.

## Components

| Component | Selector | Purpose |
|---|---|---|
| `ConfirmationModalComponent` | `app-confirmation-modal` | Material dialog with title, message, Cancel and Confirm buttons. Opened via `MatDialog.open()` with `ConfirmationModalData`. Returns `true` on confirm, `false` on cancel. |

## Types

- `ConfirmationModalData` — `{ title: string; message: string; confirmText?: string; cancelText?: string }`

## Usage

```typescript
this.dialog.open(ConfirmationModalComponent, {
  data: { title: 'Delete?', message: 'This cannot be undone.' }
}).afterClosed().subscribe(confirmed => { ... });
```

## Acceptance Criteria

- [ ] Modal displays title, message, Cancel and Confirm buttons
- [ ] Confirm button uses `color="warn"` and `mat-flat-button`
- [ ] Cancel button uses default `mat-button` style
- [ ] `confirmText` and `cancelText` are configurable with defaults "Confirm" / "Cancel"
- [ ] Dialog closes with `true` on confirm, `false` on cancel
- [ ] Uses `ChangeDetectionStrategy.OnPush`
