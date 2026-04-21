# Shared — Spec

## What it is

A cross-feature utility bucket for UI pieces that do not belong to any single domain feature. Today it holds one thing: a generic confirmation dialog used by other features when they need the user to confirm a destructive action (currently only the user-management delete flow). It is also the drop-point for any future app-wide reusable component, directive, or pipe.

## How it behaves

### The confirmation dialog

The dialog shows a title and a message passed in by the caller, plus two buttons at the bottom: Cancel on the left and a red Confirm button on the right. The caller can override the button labels; if they don't, the buttons read "Cancel" and "Confirm". Clicking Confirm closes the dialog and hands the caller `true`; clicking Cancel closes it and hands back `false`. The caller opens the dialog by passing in a data object with the title, message, and optional custom button text.

### The types it exports

The feature also exports a TypeScript type that describes the data payload the dialog expects — callers use it to type-check what they pass in.

### Packaging

Everything is surfaced through a single entry point so consumers import from `@features/shared` rather than reaching into individual files. A legacy module-style wrapper is exported alongside the dialog, but nothing in the app actually uses it.

## Acceptance criteria

- [ ] The dialog renders the caller's title at the top and the caller's message in the body.
- [ ] The Confirm button is styled as a filled red (warn) button; Cancel is a plain text button.
- [ ] When the caller omits the button labels, the buttons read "Confirm" and "Cancel".
- [ ] When the caller provides custom button labels, those labels are used verbatim.
- [ ] Clicking Confirm closes the dialog and returns `true` to the caller.
- [ ] Clicking Cancel closes the dialog and returns `false` to the caller.
- [ ] The dialog works as a standalone component — consumers do not need to import an NgModule to use it.
- [ ] The data-payload type is exported as a TypeScript type (not a runtime value).
- [ ] The `@features/shared` entry point exposes exactly the dialog, the data-payload type, and the legacy module wrapper.

## Known gaps

- The legacy module wrapper is exported from the feature's entry point but nothing in `src/` imports it — it is a dead export kept only for historical reasons.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Dialog template (title, message, action buttons) | `src/app/features/shared/components/confirmation-modal/confirmation-modal.component.ts:17-28` |
| Default button labels ("Cancel" / "Confirm") | `confirmation-modal.component.ts:23,26` |
| Close with `true` on confirm / `false` on cancel | `confirmation-modal.component.ts:22,25` |
| Data-payload type (`ConfirmationModalData`) | `confirmation-modal.component.ts:6-11` |
| Data injected via `MAT_DIALOG_DATA` | `confirmation-modal.component.ts:34` |
| Standalone component + OnPush change detection | `confirmation-modal.component.ts:30,33` |
| Legacy module-style wrapper (unused) | `src/app/features/shared/shared.module.ts:4-8` |
| Barrel entry point (`@features/shared`) | `src/app/features/shared/index.ts:1-3` |
| Path-alias registration | `tsconfig.json:18` |
| Consumer: delete-user confirmation | `src/app/features/user-management/pages/users.page.ts:10,84,89` |
