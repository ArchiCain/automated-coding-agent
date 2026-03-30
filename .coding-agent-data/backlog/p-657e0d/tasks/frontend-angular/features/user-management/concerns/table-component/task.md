---
id: t-t5f8c2
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Table Component

## Purpose
Create Angular Material table component for displaying users with sorting, pagination, row actions (edit/delete/toggle enabled), and responsive design following Material Design principles.

## Context

### Conventions
Follow Angular Material table patterns:
- **mat-table**: Use Material table with datasource for data binding
- **MatTableDataSource**: Use for client-side sorting and filtering integration
- **MatPaginator**: Material paginator with configurable page sizes (5, 10, 25, 50)
- **MatSort**: Material sort headers for sortable columns
- **Action columns**: Icon buttons for edit, delete, and toggle enabled actions
- **Responsive design**: Hide less important columns on mobile using breakpoints

Reference existing React table patterns:
- `projects/frontend/app/src/features/user-management/components/UsersTable.tsx` - Column definitions and action patterns
- Material design for consistent styling and interaction patterns

### Interfaces
```typescript
// Component input/output interfaces
interface UserTableComponent {
  users: User[];
  isLoading: boolean;
  displayedColumns: string[];
  dataSource: MatTableDataSource<User>;
  pageSizeOptions: number[];
}

// Event emitter interfaces
interface UserTableEvents {
  sortChange: EventEmitter<{ field: UserSortField; direction: SortDirection }>;
  pageChange: EventEmitter<{ page: number; pageSize: number }>;
  userEdit: EventEmitter<User>;
  userDelete: EventEmitter<User>;
  userToggleEnabled: EventEmitter<User>;
}

// Column definition interface
interface TableColumn {
  key: string;
  label: string;
  sortable: boolean;
  responsive?: boolean; // Hide on mobile
  align?: 'left' | 'center' | 'right';
}
```

### Boundaries
- **Exposes**: Reusable table component with user data display and action events
- **Consumes**: User data array, loading state, and event handlers from parent component
- **Constraints**:
  - Must support all sortable columns (username, email, firstName, lastName, createdTimestamp)
  - Must provide inline action buttons for edit, delete, and enable/disable
  - Must handle empty states and loading states gracefully
  - Must be responsive and hide less critical columns on mobile devices

### References
- `projects/frontend/app/src/features/user-management/components/UsersTable.tsx` - React table implementation and column structure
- Angular Material Table documentation for mat-table, mat-paginator, and mat-sort
- Material Design guidelines for data tables and responsive behavior

## Specification

### Requirements
- Create Angular Material table component for user data display
- Implement sorting for username, email, first name, last name, and creation date
- Provide pagination with options for 5, 10, 25, 50 rows per page
- Include action column with edit, delete, and toggle enabled buttons
- Handle loading states with skeleton loaders or progress indicators
- Implement responsive design hiding secondary columns on mobile
- Support empty state when no users are available

### Files
- `src/features/user-management/components/user-table.component.ts` - Table component class
- `src/features/user-management/components/user-table.component.html` - Material table template
- `src/features/user-management/components/user-table.component.scss` - Table component styles
- `src/features/user-management/components/user-table.component.spec.ts` - Component unit tests

### Acceptance Criteria
- [ ] Table displays all user columns: username, email, firstName, lastName, role, status, actions
- [ ] Sort headers work for username, email, firstName, lastName, createdTimestamp
- [ ] Clicking sort headers emits sortChange events with field and direction
- [ ] Pagination controls display with 5, 10, 25, 50 page size options
- [ ] Page changes emit pageChange events with page number and size
- [ ] Edit button emits userEdit event with selected user
- [ ] Delete button emits userDelete event with selected user
- [ ] Toggle enabled button emits userToggleEnabled event with selected user
- [ ] Loading state shows appropriate loading indicator
- [ ] Empty state shows "No users found" message when users array is empty
- [ ] Role column displays user roles as chips with appropriate colors
- [ ] Status column shows enabled/disabled status as colored chips
- [ ] Table is responsive and hides secondary columns on mobile devices
- [ ] Action buttons have proper tooltips and accessibility labels