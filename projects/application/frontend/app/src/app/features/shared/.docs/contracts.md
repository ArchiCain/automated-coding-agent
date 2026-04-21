# Shared — Contracts

The `shared` feature crosses no network boundary. Its contract is the TypeScript consumer surface re-exported from `@features/shared` (`src/app/features/shared/index.ts:1-3`).

## Barrel exports

```ts
// @features/shared
export { SharedModule } from './shared.module';
export { ConfirmationModalComponent } from './components/confirmation-modal/confirmation-modal.component';
export type { ConfirmationModalData } from './components/confirmation-modal/confirmation-modal.component';
```

Source: `index.ts:1-3`.

## `ConfirmationModalData`

Payload passed via `MAT_DIALOG_DATA` when opening `ConfirmationModalComponent` (`components/confirmation-modal/confirmation-modal.component.ts:6-11`).

```ts
interface ConfirmationModalData {
  title: string;          // dialog heading
  message: string;        // body paragraph
  confirmText?: string;   // defaults to 'Confirm'
  cancelText?: string;    // defaults to 'Cancel'
}
```

## `ConfirmationModalComponent`

Standalone Angular Material dialog (`components/confirmation-modal/confirmation-modal.component.ts:13-36`).

- **Selector:** `app-confirmation-modal`
- **Imports (template):** `MatDialogModule`, `MatButtonModule`
- **Change detection:** `OnPush`
- **Injects:** `MAT_DIALOG_DATA` as `ConfirmationModalData`, `MatDialogRef<ConfirmationModalComponent>`
- **Close values:** `true` on Confirm, `false` on Cancel

### Open signature

```ts
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationModalComponent, ConfirmationModalData } from '@features/shared';

const ref = dialog.open<ConfirmationModalComponent, ConfirmationModalData, boolean>(
  ConfirmationModalComponent,
  {
    data: {
      title: 'Delete User',
      message: 'Are you sure you want to delete "alice"?',
      confirmText: 'Delete',
    } satisfies ConfirmationModalData,
  },
);

ref.afterClosed().subscribe((confirmed: boolean | undefined) => { /* ... */ });
```

Actual call site: `features/user-management/pages/users.page.ts:83-97`.

## `SharedModule`

```ts
@NgModule({
  imports: [ConfirmationModalComponent],
  exports: [ConfirmationModalComponent],
})
export class SharedModule {}
```

Source: `shared.module.ts:4-8`. Intended for consumers that still use NgModule-style registration. Currently unused in this repo (see `spec.md` Discrepancies / consumers table).
