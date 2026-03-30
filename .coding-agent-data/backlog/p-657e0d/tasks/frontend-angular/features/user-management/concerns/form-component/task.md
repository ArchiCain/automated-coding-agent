---
id: t-f9k1m6
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Form Component

## Purpose
Create reactive form component for user creation and editing with Material form fields, validation, role selection, and form state management supporting both create and edit modes.

## Context

### Conventions
Follow Angular reactive forms patterns:
- **FormGroup**: Use reactive forms with FormBuilder for type safety
- **FormControl**: Individual controls with validators and error states
- **Material form fields**: Use mat-form-field with mat-input, mat-select for consistent styling
- **Validation**: Client-side validation with error messages displayed below fields
- **Async validation**: For email uniqueness checking during create mode
- **Form modes**: Support both 'create' and 'edit' modes with different field requirements

Reference React form patterns:
- `projects/frontend/app/src/features/user-management/components/UserForm.tsx` - Form structure and validation logic
- Material design form field specifications for consistent user experience

### Interfaces
```typescript
// Form component interfaces
interface UserFormComponent {
  mode: 'create' | 'edit';
  initialUser?: User;
  isSubmitting: boolean;
  userForm: FormGroup;
}

// Form value interfaces
interface UserFormValue {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword?: string; // Only for create mode
  role: Role;
}

// Form events
interface UserFormEvents {
  formSubmit: EventEmitter<CreateUserRequest | UpdateUserRequest>;
  formCancel: EventEmitter<void>;
  formValueChanges: EventEmitter<UserFormValue>;
}

// Validation interfaces
interface FormValidationErrors {
  email?: string[];
  firstName?: string[];
  lastName?: string[];
  temporaryPassword?: string[];
  role?: string[];
}
```

### Boundaries
- **Exposes**: Reactive form component with validation and submission events
- **Consumes**: User data (for edit mode), role options, and submission handlers from parent
- **Constraints**:
  - Must validate email format and uniqueness (create mode only)
  - Must require password for create mode, exclude for edit mode
  - Must provide role selection with available role options
  - Must handle form state (pristine, dirty, valid, invalid)
  - Must display validation errors in real-time

### References
- `projects/frontend/app/src/features/user-management/components/UserForm.tsx` - React form implementation with validation
- `projects/frontend/app/src/features/user-management/types.ts` - User interfaces and validation requirements
- Angular Reactive Forms documentation for validation and form control patterns

## Specification

### Requirements
- Create reactive form component supporting create and edit modes
- Implement email, firstName, lastName, password (create only), and role fields
- Add form validation with real-time error display
- Handle form submission with appropriate request type (create vs update)
- Provide role selection dropdown with available roles
- Implement form state management and loading states during submission

### Files
- `src/features/user-management/components/user-form.component.ts` - Form component class
- `src/features/user-management/components/user-form.component.html` - Material form template
- `src/features/user-management/components/user-form.component.scss` - Form component styles
- `src/features/user-management/components/user-form.component.spec.ts` - Component unit tests

### Acceptance Criteria
- [ ] Form supports both 'create' and 'edit' modes with appropriate fields
- [ ] Email field validates format and shows real-time validation errors
- [ ] Password field appears only in create mode and validates strength
- [ ] First name and last name fields are optional with proper validation
- [ ] Role dropdown shows available roles and validates selection
- [ ] Form displays validation errors below each field in real-time
- [ ] Submit button is disabled when form is invalid or submitting
- [ ] Cancel button emits formCancel event without validation
- [ ] Form submission emits appropriate request type (CreateUserRequest or UpdateUserRequest)
- [ ] Form state (loading, disabled) is properly managed during submission
- [ ] Edit mode pre-populates form with existing user data
- [ ] Form reset functionality clears all fields and validation states
- [ ] Form follows Material Design accessibility guidelines
- [ ] Form is responsive and works on mobile devices