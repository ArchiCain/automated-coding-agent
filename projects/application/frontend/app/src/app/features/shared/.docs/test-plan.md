# Shared — Test Plan

Test scope is the `ConfirmationModalComponent` (`src/app/features/shared/components/confirmation-modal/confirmation-modal.component.ts`). `SharedModule` has no runtime behavior worth testing and no consumers.

Unit tests run via Vitest through `@angular/build:unit-test` (see `angular.json:72-73`). Tests should render the component inside a Material dialog harness (`MatDialogModule` + `ComponentFixture`) or via `MatDialogHarness`.

## Contract tests (`ConfirmationModalData`)

- [ ] Barrel `@features/shared` re-exports `ConfirmationModalComponent`, `SharedModule`, and the `ConfirmationModalData` type (compile-only assertion).
- [ ] Opening the dialog with a typed `ConfirmationModalData` payload compiles; extra keys are rejected by the type system.

## Behavior tests (`ConfirmationModalComponent`)

Maps 1:1 to `spec.md` acceptance criteria.

- [ ] Renders `data.title` inside `<h2 mat-dialog-title>`.
- [ ] Renders `data.message` inside `<mat-dialog-content> <p>`.
- [ ] Confirm button has attributes `mat-flat-button` and `color="warn"`.
- [ ] Cancel button has attribute `mat-button` (no `color` binding).
- [ ] When `confirmText` is omitted, Confirm button text is exactly `Confirm`.
- [ ] When `cancelText` is omitted, Cancel button text is exactly `Cancel`.
- [ ] When `confirmText` and `cancelText` are provided, both override the defaults verbatim.
- [ ] Clicking Confirm invokes `MatDialogRef.close(true)` (assert via spy on `dialogRef.close` and that `afterClosed()` emits `true`).
- [ ] Clicking Cancel invokes `MatDialogRef.close(false)` (assert via spy and `afterClosed()` emits `false`).
- [ ] Component metadata sets `changeDetection: ChangeDetectionStrategy.OnPush` (reflect metadata or template stability under zoneless-style detection).

## E2E (consumer-driven)

Covered indirectly by `user-management` delete-user flow (see `features/user-management/.docs/test-plan.md`). No standalone E2E for `shared`.
