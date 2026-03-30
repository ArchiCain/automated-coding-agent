---
id: t-6f7g8h
parent: t-a2d6e5
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Types

## Purpose
Define TypeScript interfaces, types, and models for shared data structures, API responses, component props, and common domain objects used across all application features.

## Context

### Conventions
Follow TypeScript best practices for type definitions:
- **Interface declarations** for object shapes and contracts
- **Type aliases** for unions, primitives, and computed types
- **Generic types** for reusable type patterns
- **Barrel exports** for easy imports across features

Reference existing patterns:
- Angular component input/output typing
- RxJS Observable typing patterns

### Interfaces
```typescript
// Common API response wrapper
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

// Pagination interface
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Form validation result
interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// UI component common props
interface BaseComponent {
  id?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}
```

### Boundaries
- **Exposes**: Common interfaces, types, and enums for shared data structures
- **Consumes**: TypeScript core types and Angular-specific types
- **Constraints**: Must be well-documented, follow naming conventions, and support generic patterns

### References
- TypeScript documentation for interface and type best practices
- Angular style guide for type organization

## Specification

### Requirements
- Define common API response and request interfaces
- Create shared UI component prop types and variants
- Implement pagination, sorting, and filtering interfaces
- Define form validation and error handling types
- Create authentication and user management interfaces

### Files
- `src/app/features/shared-ui/types/api.types.ts` - API request/response interfaces
- `src/app/features/shared-ui/types/ui.types.ts` - UI component and layout types
- `src/app/features/shared-ui/types/form.types.ts` - Form validation and input types
- `src/app/features/shared-ui/types/auth.types.ts` - Authentication and user types
- `src/app/features/shared-ui/types/common.types.ts` - Common utility types and enums
- `src/app/features/shared-ui/types/index.ts` - Barrel export for all types

### Implementation Details
- API types include generic response wrappers, pagination, and error structures
- UI types define component variants, sizes, states, and layout configurations
- Form types cover validation rules, field configurations, and submission states
- Auth types define user models, authentication states, and permission structures
- Common types include enums, utility types, and shared constants

### Acceptance Criteria
- [ ] API types provide consistent request/response structure across features
- [ ] UI types cover all component variants and layout configurations
- [ ] Form types support comprehensive validation and error handling
- [ ] Auth types define clear user and authentication structures
- [ ] All types are properly exported and documented for easy consumption