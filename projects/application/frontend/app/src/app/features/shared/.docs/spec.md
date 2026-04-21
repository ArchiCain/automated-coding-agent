# Shared — Spec

**Feature directory:** `src/app/features/shared/`

## Purpose

Cross-feature UI utilities that do not belong to any single domain feature. At present this module contains one generic Angular Material dialog used for destructive-action confirmations by other features (currently `user-management`). It is the drop-point for any future app-wide reusable component, directive, or pipe.

## Behavior

- Exports a standalone Angular Material confirmation dialog component (`ConfirmationModalComponent`) that:
  - Renders a Material dialog with `<h2 mat-dialog-title>` showing `data.title` and a `<mat-dialog-content><p>` showing `data.message` (`components/confirmation-modal/confirmation-modal.component.ts:17-20`).
  - Renders Cancel and Confirm buttons in `<mat-dialog-actions align="end">`; Cancel is a default `mat-button`, Confirm is `mat-flat-button color="warn"` (`confirmation-modal.component.ts:21-28`).
  - Uses `data.cancelText` / `data.confirmText` when provided, else falls back to literal `'Cancel'` / `'Confirm'` (`confirmation-modal.component.ts:23,26`).
  - Closes the dialog with boolean `true` on Confirm click and `false` on Cancel click via `MatDialogRef.close()` (`confirmation-modal.component.ts:22,25`).
  - Receives its data through `MAT_DIALOG_DATA` injection (`confirmation-modal.component.ts:34`) — consumers pass `data: ConfirmationModalData` to `MatDialog.open()`.
  - Declares `ChangeDetectionStrategy.OnPush` (`confirmation-modal.component.ts:30`), consistent with the project-wide ESLint rule.
- Exports a `ConfirmationModalData` TypeScript interface used by callers to type the `data` payload (`confirmation-modal.component.ts:6-11`).
- Exports an empty `SharedModule` NgModule that `imports` and re-exports `ConfirmationModalComponent` (`shared.module.ts:4-8`). This is a legacy module-style wrapper; no code in the repo imports it (see Discrepancies).

## Exports

| Export | Kind | Purpose | Consumers |
|---|---|---|---|
| `ConfirmationModalComponent` | standalone component (`confirmation-modal.component.ts:33`) | Generic warn-styled confirm/cancel dialog | `features/user-management/pages/users.page.ts:10,84` (delete-user confirmation) |
| `ConfirmationModalData` | TS interface (`confirmation-modal.component.ts:6-11`) | Type for `MAT_DIALOG_DATA` payload | `features/user-management/pages/users.page.ts:10,89` |
| `SharedModule` | NgModule (`shared.module.ts:8`) | Module-style re-export of `ConfirmationModalComponent` | None — never imported anywhere in `src/` |

All exports are surfaced through the barrel `index.ts:1-3` and consumed via the `@features/shared` path alias (`tsconfig.json:18`).

## Acceptance Criteria

- [ ] `ConfirmationModalComponent` renders `data.title` inside `<h2 mat-dialog-title>` and `data.message` inside a `<p>` in `<mat-dialog-content>`.
- [ ] Confirm button is rendered as `mat-flat-button` with `color="warn"`; Cancel button is a default `mat-button`.
- [ ] `confirmText` defaults to the string `Confirm` and `cancelText` defaults to `Cancel` when the respective field is omitted from `ConfirmationModalData`.
- [ ] Custom `confirmText` and `cancelText` override the defaults verbatim.
- [ ] Clicking Confirm closes the dialog with boolean `true`; clicking Cancel closes the dialog with boolean `false`.
- [ ] The component is standalone (no declaring NgModule required) and declares `ChangeDetectionStrategy.OnPush`.
- [ ] `ConfirmationModalData` is exported as a `type` from `@features/shared` (not a runtime symbol).
- [ ] The barrel `index.ts` exposes exactly `SharedModule`, `ConfirmationModalComponent`, and the `ConfirmationModalData` type.
