---
id: t-p4g3e1
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Page

## Purpose
Create the main user management page component that serves as the route-level container, integrating search functionality, user table display, and navigation actions for the admin user interface.

## Context

### Conventions
Follow Angular page component patterns:
- **Component suffix**: `.page.ts` for route-level components
- **Template files**: Separate `.html` templates for complex layouts
- **Reactive forms**: Use Angular reactive forms for search input with debounced filtering
- **Material layout**: Use Material flex layout and card containers
- **Loading states**: Show skeleton loaders and progress indicators during API calls

Reference Angular patterns:
- Page components handle route-level state management and coordinate child components
- Use Angular services for data fetching and state management
- Implement OnInit and OnDestroy for lifecycle management
- Use RxJS operators for reactive programming patterns

### Interfaces
```typescript
// Component state interfaces
interface UserManagementPageState {
  users: User[];
  isLoading: boolean;
  searchTerm: string;
  sortField: UserSortField;
  sortDirection: SortDirection;
  currentPage: number;
  pageSize: number;
  totalUsers: number;
}

// Component methods
interface UserManagementPageComponent {
  ngOnInit(): void;
  ngOnDestroy(): void;
  onSearchChange(searchTerm: string): void;
  onSortChange(field: UserSortField): void;
  onPageChange(page: number, size: number): void;
  onUserEdit(user: User): void;
  onUserDelete(user: User): void;
  onUserToggleEnabled(user: User): void;
  openCreateUserDialog(): void;
}
```

### Boundaries
- **Exposes**: Route-level page at `/admin/users` with complete user management interface
- **Consumes**: UserManagementService for data operations, permission guard for access control
- **Constraints**:
  - Must be protected by permission guard requiring `users:read` access
  - Must implement 300ms debounced search with FormControl and RxJS operators
  - Must coordinate between search, table, and dialog components
  - Must handle loading states and error handling for all user operations

### References
- `projects/frontend/app/src/features/user-management/pages/UsersPage.tsx` - React page component structure and state management
- `projects/frontend/app/src/features/user-management/components/UsersTable.tsx` - Table component integration patterns
- Angular Material documentation for page layouts and responsive design

## Specification

### Requirements
- Create Angular page component for user management route (`/admin/users`)
- Implement debounced search functionality with reactive forms (300ms delay)
- Coordinate user table display with pagination and sorting
- Handle user CRUD operations through service integration
- Provide Material dialog integration for user forms
- Implement loading states and error handling

### Files
- `src/features/user-management/pages/user-management.page.ts` - Main page component class
- `src/features/user-management/pages/user-management.page.html` - Page template with Material layout
- `src/features/user-management/pages/user-management.page.scss` - Page-specific styles

### Acceptance Criteria
- [ ] Page component loads and displays user table on route activation
- [ ] Search input filters users with 300ms debounce (no API calls on every keystroke)
- [ ] Pagination controls update table data correctly
- [ ] Sort controls in table headers update data correctly
- [ ] Create user button opens dialog for new user creation
- [ ] Edit user action navigates to user edit dialog
- [ ] Delete user action shows confirmation and performs deletion
- [ ] Toggle enabled action immediately updates user status
- [ ] Loading states display during API operations
- [ ] Error states display appropriate user-friendly messages
- [ ] Page is accessible only to users with `users:read` permission