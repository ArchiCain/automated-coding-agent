# User Management

Comprehensive user administration interface for managing users, roles, and permissions.

## Purpose

The user-management package provides a complete UI layer for administering users in the system. It integrates with Keycloak for authentication and authorization, offering features to create, read, update, and delete users with role-based access control.

## Usage

Import pages and components into your routing configuration:

```typescript
import { UsersPage, UserPage } from '@packages/user-management';

// In your router configuration
<Route path="/admin/users" element={<UsersPage />} />
<Route path="/admin/users/:id" element={<UserPage />} />
<Route path="/admin/users/new" element={<UserPage />} />
```

Use the API service for direct backend communication:

```typescript
import { userManagementApi } from '@packages/user-management';

// Fetch users with pagination and search
const response = await userManagementApi.getUsers({
  page: 1,
  pageSize: 10,
  search: 'john',
  sortBy: 'username',
  sortDirection: 'asc',
});

// Create a new user
const newUser = await userManagementApi.createUser({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  temporaryPassword: 'TempPass123!',
  role: 'user',
});

// Update an existing user
await userManagementApi.updateUser(userId, {
  firstName: 'Jane',
  lastName: 'Smith',
  role: 'admin',
});

// Toggle user enabled status
await userManagementApi.toggleUserEnabled(userId, true);

// Delete a user
await userManagementApi.deleteUser(userId);
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `UsersPage` | React Component | Main users list page with search, filtering, and pagination |
| `UserPage` | React Component | Create or edit user page with form validation |
| `UsersTable` | React Component | Reusable table component for displaying users |
| `UserForm` | React Component | Reusable form component for user creation/editing |
| `DeleteUserModal` | React Component | Confirmation modal for user deletion |
| `userManagementApi` | API Service | Backend API client for user management operations |
| `User` | Interface | Full user representation from API responses |
| `CreateUserRequest` | Interface | Request body for creating new users |
| `UpdateUserRequest` | Interface | Request body for updating user details |
| `UserListQuery` | Interface | Query parameters for listing users with pagination/search |
| `UserListResponse` | Interface | Paginated response for user listing |
| `PaginationMeta` | Interface | Pagination metadata |

## Components

### UsersPage
Main administrative interface for managing users.

**Features:**
- List all users with pagination
- Search users by username, email, first name, or last name
- Sort by any column (username, email, firstName, lastName, createdTimestamp)
- Adjust rows per page (5, 10, 25, 50)
- Toggle user enabled/disabled status
- Delete users with confirmation modal
- Edit users by clicking the edit icon

**Props:** None (uses React Router and global state)

### UserPage
Form page for creating new users or editing existing users.

**Features:**
- Form validation (email format, required fields)
- Password field with visibility toggle (create mode only)
- Email field disabled in edit mode (Keycloak limitation)
- Role selection (User, Admin)
- Loading state with spinner
- Success/error notifications
- Auto-navigation to users list after successful submission

**URL Parameters:**
- `id` - User ID for edit mode (optional, omitted for create mode)

### UsersTable
Reusable table component displaying user data.

**Props:**
- `users: User[]` - Array of users to display
- `isLoading: boolean` - Loading state
- `sortBy?: UserSortField` - Current sort field
- `sortDirection?: SortDirection` - Current sort direction
- `onSort: (field: UserSortField) => void` - Sort handler
- `onToggleEnabled: (user: User) => void` - Enable/disable handler
- `onDelete: (user: User) => void` - Delete handler
- `className?: string` - Optional CSS class

### UserForm
Reusable form component for creating or editing users.

**Props:**
- `mode: UserFormMode` - 'create' or 'edit'
- `initialValues?: Partial<UserFormValues>` - Form initial values
- `isLoading: boolean` - Submission state
- `onSubmit: (values: UserFormValues) => Promise<void>` - Form submit handler

**Form Validation:**
- Email: Required, valid format
- First Name: Required, non-empty
- Last Name: Required, non-empty
- Password (create mode): Required, minimum 8 characters
- Role: Required

### DeleteUserModal
Confirmation modal for user deletion.

**Props:**
- `isOpen: boolean` - Modal visibility
- `user: User | null` - User to delete
- `onClose: () => void` - Close handler
- `onSuccess: () => void` - Success callback

## Services

### userManagementApi

Backend API client with the following methods:

```typescript
// Get paginated list of users
getUsers(query?: UserListQuery): Promise<UserListResponse>

// Get single user by ID
getUserById(id: string): Promise<User>

// Create new user
createUser(data: CreateUserRequest): Promise<User>

// Update user details
updateUser(id: string, data: UpdateUserRequest): Promise<User>

// Delete user
deleteUser(id: string): Promise<void>

// Toggle user enabled status
toggleUserEnabled(id: string, enabled: boolean): Promise<User>
```

All methods include error handling for Axios errors with user-friendly error messages.

## Types

### User
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  roles: Role[];
}
```

### CreateUserRequest
```typescript
interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}
```

### UpdateUserRequest
```typescript
interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: Role;
}
```

### UserListQuery
```typescript
interface UserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: UserSortField;
  sortDirection?: SortDirection;
}
```

### PaginationMeta
```typescript
interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports for pages, components, services, and types |
| `types.ts` | TypeScript type definitions matching backend DTOs |
| `pages/UsersPage.tsx` | Main users list page with search, filter, and pagination |
| `pages/UserPage.tsx` | Create/edit user page with form handling |
| `components/UsersTable.tsx` | Data table component for displaying users |
| `components/UserForm.tsx` | Reusable form component with validation |
| `components/DeleteUserModal.tsx` | Confirmation modal for deletions |
| `services/user-management.api.ts` | API client for backend communication |

## Dependencies

- **React** - UI framework
- **React Router DOM** - Client-side routing (for navigation links)
- **Material-UI (MUI)** - Component library for UI rendering
- **Material-UI Icons** - Icon components (Edit, Delete, Search, etc.)
- **Axios** - HTTP client for API requests (wrapped in api-client package)
- **keycloak-auth package** - Role and permission types
- **api-client package** - Configured Axios instance with auth

## Backend Integration

This package communicates with a backend API at `/users` endpoint. The backend should:

1. Handle pagination with `page` and `pageSize` query parameters (1-indexed pages)
2. Support search across username, email, firstName, and lastName
3. Support sorting with `sortBy` and `sortDirection` query parameters
4. Return user data matching the `User` interface
5. Integrate with Keycloak for role management
6. Treat email as immutable username after user creation

## Notes

- Email addresses are used as usernames in Keycloak and cannot be changed after creation
- Temporary passwords are set during user creation and must be at least 8 characters
- Users must have at least one role (defaults to 'user')
- Pagination is 1-indexed on the frontend and backend
- Search is debounced at 300ms to prevent excessive API calls
