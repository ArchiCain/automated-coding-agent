---
id: t-5e6f7g
parent: t-a2d6e5
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Utilities

## Purpose
Implement utility services, helper functions, and common directives that provide reusable functionality across all application features including form validation, date formatting, and responsive utilities.

## Context

### Conventions
Follow Angular utility patterns:
- **Injectable services** for stateful utilities
- **Pure functions** for stateless transformations
- **Custom directives** for DOM interactions
- **Pipes** for template data transformation

Reference existing patterns:
- Angular best practices for utility organization
- RxJS operators for reactive utilities

### Interfaces
```typescript
// Validation utility interface
interface ValidationUtils {
  isEmail(value: string): boolean;
  isPhoneNumber(value: string): boolean;
  isRequired(value: any): boolean;
  minLength(value: string, min: number): boolean;
}

// Date utility interface
interface DateUtils {
  formatDate(date: Date, format: string): string;
  parseDate(dateString: string): Date;
  isToday(date: Date): boolean;
  timeAgo(date: Date): string;
}

// Responsive utility interface
interface ResponsiveUtils {
  isMobile(): boolean;
  isTablet(): boolean;
  isDesktop(): boolean;
  matchMedia(query: string): Observable<boolean>;
}

// Storage utility interface
interface StorageUtils {
  setItem(key: string, value: any): void;
  getItem<T>(key: string): T | null;
  removeItem(key: string): void;
  clear(): void;
}
```

### Boundaries
- **Exposes**: Validation helpers, date formatters, responsive utilities, and storage services
- **Consumes**: Angular CDK utilities, RxJS operators, and browser APIs
- **Constraints**: Must be tree-shakable, support SSR, and provide type safety

### References
- Angular CDK for platform detection and responsive utilities
- RxJS documentation for reactive patterns

## Specification

### Requirements
- Implement form validation utilities and custom validators
- Create date formatting and manipulation utilities
- Implement responsive breakpoint detection service
- Create local storage wrapper with type safety
- Implement common string and array manipulation helpers

### Files
- `src/app/features/shared-ui/utils/validation.utils.ts` - Form validation helpers and validators
- `src/app/features/shared-ui/utils/date.utils.ts` - Date formatting and manipulation utilities
- `src/app/features/shared-ui/services/responsive.service.ts` - Breakpoint detection service
- `src/app/features/shared-ui/services/storage.service.ts` - Local/session storage wrapper
- `src/app/features/shared-ui/utils/string.utils.ts` - String manipulation helpers
- `src/app/features/shared-ui/utils/array.utils.ts` - Array manipulation helpers
- `src/app/features/shared-ui/directives/click-outside.directive.ts` - Custom directives
- `src/app/features/shared-ui/pipes/safe-html.pipe.ts` - Custom pipes for templates

### Implementation Details
- Validation utilities provide common patterns (email, phone, required, etc.)
- Date utilities handle formatting, parsing, and relative time display
- Responsive service uses CDK BreakpointObserver for media query matching
- Storage service provides type-safe localStorage/sessionStorage wrapper
- Custom directives for common DOM interactions (click-outside, auto-focus, etc.)

### Acceptance Criteria
- [ ] Validation utilities provide comprehensive form validation helpers
- [ ] Date utilities handle common formatting and manipulation tasks
- [ ] Responsive service accurately detects breakpoint changes
- [ ] Storage service provides type-safe local storage access
- [ ] String and array utilities cover common transformation needs