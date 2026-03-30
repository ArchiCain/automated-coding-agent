---
id: t-a2d6e5
parent: t-a9f3e2
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Plan: Shared UI Feature

## Purpose
Implement reusable UI components, Angular Material theme configuration, API client services, HTTP interceptors, and common utilities that support all application features.

## Context

### Conventions
Follow Angular 21 shared feature patterns:
- **Standalone components** for reusable UI elements
- **Angular Material v21** theme with Azure/Blue palette
- **HTTP client** with interceptors for auth and error handling
- **Global styles** with 8px spacing system and consistent border radius
- **Responsive design** with mobile-first breakpoints

Reference existing patterns:
- `projects/coding-agent-frontend/app/src/styles.scss` - Material theme configuration
- `projects/coding-agent-frontend/app/package.json` - Dependencies and versions
- `projects/frontend/app/src/features/api-client/` - React API client patterns

### Interfaces
```typescript
// API client interfaces
interface ApiClient {
  get<T>(url: string, options?: RequestOptions): Observable<T>;
  post<T>(url: string, body: any, options?: RequestOptions): Observable<T>;
  put<T>(url: string, body: any, options?: RequestOptions): Observable<T>;
  delete<T>(url: string, options?: RequestOptions): Observable<T>;
}

interface RequestOptions {
  headers?: { [key: string]: string };
  params?: { [key: string]: string };
  withCredentials?: boolean;
}

// Theme configuration
interface MaterialTheme {
  primary: string; // mat.$azure-palette
  tertiary: string; // mat.$blue-palette
  density: number; // 0
  mode: 'light' | 'dark';
}

// Layout interfaces
interface AppLayoutComponent {
  user: AuthUser | null;
  showSidebar: boolean;
  onToggleSidebar: () => void;
}
```

### Boundaries
- **Exposes**: Reusable components, API client, theme configuration, layout components, and utility services
- **Consumes**: Angular Material v21, HTTP client, and authentication context
- **Constraints**:
  - Must provide consistent Material theme matching coding-agent-frontend
  - Must handle HTTP interceptors for authentication and error handling
  - Must support responsive design with mobile drawer navigation
  - Must be imported by all other features

### References
- `projects/coding-agent-frontend/app/src/styles.scss` - Exact theme implementation to replicate
- `projects/coding-agent-frontend/app/package.json` - Angular Material and dependencies
- `projects/frontend/app/src/features/api-client/` - HTTP client service patterns
- `projects/frontend/app/src/features/layouts/` - Layout component structures

## Children

| Name | Path | Description |
|------|------|-------------|
| Material Theme | ./concerns/material-theme/task.md | Angular Material theme configuration with Azure/Blue palette and global styles |
| API Client | ./concerns/api-client/task.md | HTTP client service with authentication and error handling interceptors |
| Layout Components | ./concerns/layout-components/task.md | Responsive layout components including app shell, header, and navigation drawer |
| Common Components | ./concerns/common-components/task.md | Reusable UI components like buttons, cards, loading indicators, and form controls |
| Utilities | ./concerns/utilities/task.md | Utility services and helper functions for validation, date formatting, and responsive detection |
| Types | ./concerns/types/task.md | TypeScript interfaces and types for shared data structures and component props |