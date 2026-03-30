---
id: t-4d5e6f
parent: t-a2d6e5
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Common Components

## Purpose
Implement reusable UI components including buttons, form controls, cards, dialogs, and loading indicators that provide consistent design patterns across all application features.

## Context

### Conventions
Follow Angular Material component patterns:
- **Standalone components** extending or wrapping Material components
- **Material Design** principles with consistent spacing and typography
- **Accessibility** features using CDK a11y utilities
- **Input/Output patterns** for component communication

Reference existing patterns:
- `projects/coding-agent-frontend/app/src/app/shared/components/confirm-dialog/` - Angular dialog component
- `projects/coding-agent-frontend/app/src/app/shared/components/danger-zone/` - Custom component patterns

### Interfaces
```typescript
// Button component variants
interface AppButton {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'small' | 'medium' | 'large';
  disabled: boolean;
  loading: boolean;
}

// Card component interface
interface AppCard {
  title?: string;
  subtitle?: string;
  actions?: boolean;
  elevation: number;
}

// Loading indicator interface
interface LoadingIndicator {
  size: 'small' | 'medium' | 'large';
  type: 'spinner' | 'linear' | 'skeleton';
  message?: string;
}

// Form field wrapper interface
interface AppFormField {
  label: string;
  required: boolean;
  error?: string;
  hint?: string;
}
```

### Boundaries
- **Exposes**: Reusable UI components, form controls, and dialog utilities
- **Consumes**: Angular Material components, CDK utilities, and reactive forms
- **Constraints**: Must maintain Material Design consistency, provide accessibility, and support theming

### References
- `projects/coding-agent-frontend/app/src/app/shared/components/` - Existing shared component patterns
- Material Design guidelines for component specifications

## Specification

### Requirements
- Implement consistent button component with variant and size options
- Create card component with flexible header, content, and actions
- Implement loading indicators for various UI states
- Create form field wrapper for consistent form styling
- Implement confirmation dialog and modal utilities

### Files
- `src/app/features/shared-ui/components/app-button/app-button.component.ts` - Button component with variants
- `src/app/features/shared-ui/components/app-button/app-button.component.html` - Button template
- `src/app/features/shared-ui/components/app-button/app-button.component.scss` - Button styles
- `src/app/features/shared-ui/components/app-card/app-card.component.ts` - Card component
- `src/app/features/shared-ui/components/app-card/app-card.component.html` - Card template
- `src/app/features/shared-ui/components/app-card/app-card.component.scss` - Card styles
- `src/app/features/shared-ui/components/loading-indicator/loading-indicator.component.ts` - Loading spinner/progress
- `src/app/features/shared-ui/components/loading-indicator/loading-indicator.component.html` - Loading template
- `src/app/features/shared-ui/components/loading-indicator/loading-indicator.component.scss` - Loading styles
- `src/app/features/shared-ui/components/app-form-field/app-form-field.component.ts` - Form field wrapper
- `src/app/features/shared-ui/components/app-form-field/app-form-field.component.html` - Form field template
- `src/app/features/shared-ui/components/app-form-field/app-form-field.component.scss` - Form field styles
- `src/app/features/shared-ui/services/dialog.service.ts` - Dialog utilities and confirmation dialogs

### Implementation Details
- Button component extends mat-button with custom variants (primary/secondary/danger/ghost)
- Card component wraps mat-card with consistent header/content/actions layout
- Loading indicator provides spinner, linear progress, and skeleton loading states
- Form field wrapper standardizes label, error, and hint display patterns
- Dialog service provides easy confirmation and modal dialog creation

### Acceptance Criteria
- [ ] Button component provides consistent variants and sizes across the app
- [ ] Card component displays headers, content, and actions consistently
- [ ] Loading indicators work correctly for different loading states
- [ ] Form field wrapper provides consistent form styling and validation display
- [ ] Dialog service creates accessible confirmation and modal dialogs