---
id: t-d3r7w5
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Dialog Component

## Purpose
Create Material dialog component that wraps the user form for create/edit operations, handles dialog lifecycle, form submission, and provides confirmation dialogs for delete operations.

## Context

### Conventions
Follow Angular Material dialog patterns:
- **MatDialog**: Use Material dialog service for opening and closing dialogs
- **Dialog data injection**: Use MAT_DIALOG_DATA for passing data to dialog components
- **DialogRef**: Use MatDialogRef for closing dialog and returning data
- **Dialog actions**: Provide standard cancel/submit actions with proper button styling
- **Confirmation dialogs**: Separate confirmation dialog for destructive actions (delete)

Reference React dialog patterns:
- `projects/frontend/app/src/features/user-management/components/DeleteUserModal.tsx` - Confirmation dialog structure
- Material design dialog specifications for consistent user experience

### Interfaces
```typescript
// Dialog data interfaces
interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User; // For edit mode
  availableRoles: Role[];
}

interface DeleteConfirmationDialogData {
  user: User;
  confirmationText?: string;
}

// Dialog result interfaces
interface UserFormDialogResult {
  action: 'save' | 'cancel';
  user?: CreateUserRequest | UpdateUserRequest;
}

interface DeleteConfirmationDialogResult {
  confirmed: boolean;
}

// Dialog component interfaces
interface UserFormDialogComponent {
  data: UserFormDialogData;
  isSubmitting: boolean;
  onSubmit(formValue: any): void;
  onCancel(): void;
}
```

### Boundaries
- **Exposes**: Modal dialogs for user form operations and delete confirmations
- **Consumes**: Dialog data, user service for form operations, dialog service for management
- **Constraints**:
  - Must handle both create and edit dialog modes seamlessly
  - Must provide proper loading states during form submission
  - Must implement delete confirmation with clear user messaging
  - Must support keyboard navigation and accessibility
  - Must handle dialog escape/backdrop click appropriately

### References
- `projects/frontend/app/src/features/user-management/components/DeleteUserModal.tsx` - React modal patterns and confirmation logic
- Angular Material Dialog documentation for dialog lifecycle and data injection
- Material design dialog patterns for consistent user interaction

## Specification

### Requirements
- Create user form dialog component for create/edit operations
- Create delete confirmation dialog component for user deletion
- Implement proper dialog data injection and result handling
- Handle form submission with loading states and error handling
- Provide keyboard navigation and accessibility support
- Implement dialog close behavior (save/cancel/escape)

### Files
- `src/features/user-management/components/user-form-dialog.component.ts` - Form dialog component
- `src/features/user-management/components/user-form-dialog.component.html` - Dialog template
- `src/features/user-management/components/user-delete-confirmation-dialog.component.ts` - Delete confirmation dialog
- `src/features/user-management/components/user-delete-confirmation-dialog.component.html` - Delete dialog template
- `src/features/user-management/components/dialogs.spec.ts` - Dialog component tests

### Acceptance Criteria
- [ ] User form dialog opens with proper mode (create/edit) and initial data
- [ ] Dialog title reflects current mode ("Create User" or "Edit User")
- [ ] Form validation works correctly within dialog context
- [ ] Submit button shows loading state during form submission
- [ ] Dialog closes with result data after successful form submission
- [ ] Cancel button closes dialog without saving changes
- [ ] Dialog can be closed via escape key or backdrop click (with unsaved changes warning)
- [ ] Delete confirmation dialog shows user details and clear confirmation message
- [ ] Delete confirmation provides "Cancel" and "Delete" action buttons
- [ ] Delete confirmation requires explicit confirmation before proceeding
- [ ] Dialogs follow Material Design accessibility guidelines
- [ ] Dialogs are responsive and work correctly on mobile devices
- [ ] Error handling displays appropriate messages within dialog context
- [ ] Dialog animations follow Material Design motion specifications