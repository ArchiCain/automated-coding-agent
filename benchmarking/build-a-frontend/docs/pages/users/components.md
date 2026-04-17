# User Management Page — Components

## UserManagementPage (`user-management.page.ts`)

The page component. Contains the table, search input, and "Create User" button.

**Selector:** `app-user-management-page`
**Standalone:** yes
**Change detection:** OnPush
**Location:** `src/app/features/users/pages/user-management/`

### State
| Signal | Type | Purpose |
|--------|------|---------|
| `loading` | `signal<boolean>` | True while fetching users |
| `users` | `signal<UserDto[]>` | Current page of users |
| `pagination` | `signal<Pagination>` | Total, page, pageSize, totalPages |
| `searchTerm` | `signal<string>` | Current search string |
| `sortBy` | `signal<string>` | Current sort column |
| `sortDirection` | `signal<'asc' \| 'desc'>` | Current sort direction |

### Dependencies
| Service | Methods used |
|---------|-------------|
| `UsersService` | `getUsers()`, `createUser()`, `updateUser()`, `deleteUser()`, `toggleEnabled()` |
| `AuthService` | `hasPermission$('users:create')`, `hasPermission$('users:delete')` |
| `MatDialog` | `open()` for create/edit/confirm dialogs |
| `MatSnackBar` | `open()` for success/error feedback |

### Table columns
| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Email | `email` | Yes | Primary identifier |
| First Name | `firstName` | Yes | May be empty |
| Last Name | `lastName` | Yes | May be empty |
| Role | `roles[0]` | No | Displayed as `mat-chip` |
| Status | `enabled` | No | `mat-slide-toggle` |
| Created | `createdTimestamp` | Yes | Formatted as date |

---

## CreateUserDialog (`create-user-dialog.component.ts`)

Dialog for creating a new user.

**Selector:** `app-create-user-dialog`
**Standalone:** yes
**Change detection:** OnPush
**Location:** `src/app/features/users/components/create-user-dialog/`

### Form
```typescript
createForm = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  firstName: [''],
  lastName: [''],
  temporaryPassword: ['', Validators.required],
  role: ['user', Validators.required],  // default to 'user'
});
```

### Layout
```
┌─────────────────────────────────┐
│  Create User            [X]    │
├─────────────────────────────────┤
│  [Email            ] *         │
│  [First Name       ]          │
│  [Last Name        ]          │
│  [Temporary Password] *        │
│  [Role ▾           ] *         │
├─────────────────────────────────┤
│              Cancel  [ Create ] │
└─────────────────────────────────┘
```

- Width: 480px
- Role: `mat-select` with options "admin" and "user"
- Cancel: `mat-button` (text), closes dialog
- Create: `mat-flat-button color="primary"`, disabled until form valid
- Error from backend displayed below form

---

## UserDetailDialog (`user-detail-dialog.component.ts`)

Dialog for viewing and editing a user.

**Selector:** `app-user-detail-dialog`
**Standalone:** yes
**Change detection:** OnPush
**Location:** `src/app/features/users/components/user-detail-dialog/`

### Input
- `data: { user: UserDto }` via `MAT_DIALOG_DATA`

### Form
```typescript
editForm = this.fb.group({
  firstName: [user.firstName || ''],
  lastName: [user.lastName || ''],
  role: [user.roles[0] || 'user', Validators.required],
});
```

### Layout
```
┌─────────────────────────────────┐
│  User Details           [X]    │
├─────────────────────────────────┤
│  Email: admin@example.com (ro) │
│  [First Name       ]          │
│  [Last Name        ]          │
│  [Role ▾           ]          │
│  Created: Jan 15, 2026         │
│  Status: Enabled               │
├─────────────────────────────────┤
│  [Delete]      Cancel  [ Save ] │
└─────────────────────────────────┘
```

- Width: 480px
- Email: displayed as read-only text (not editable)
- Created: formatted timestamp
- Delete button: `mat-button color="warn"`, left-aligned, only visible if `users:delete` permission
- Cancel: `mat-button` (text)
- Save: `mat-flat-button color="primary"`, disabled until form dirty + valid

---

## ConfirmDialog (`confirm-dialog.component.ts`)

Generic confirmation dialog for destructive actions.

**Selector:** `app-confirm-dialog`
**Standalone:** yes
**Change detection:** OnPush
**Location:** `src/app/features/users/components/confirm-dialog/`

### Input
- `data: { title: string, message: string, confirmLabel: string, confirmColor: 'primary' | 'warn' }`

### Layout
```
┌─────────────────────────────────┐
│  {title}                       │
├─────────────────────────────────┤
│  {message}                     │
├─────────────────────────────────┤
│              Cancel  [{confirm}]│
└─────────────────────────────────┘
```

- Confirm button uses the provided `confirmColor` (typically `warn` for delete)
- Returns `true` on confirm, `false`/undefined on cancel

---

## UsersService (`users.service.ts`)

**Location:** `src/app/features/users/services/`
**Provided in:** root

### Methods
| Method | API Call | Returns |
|--------|----------|---------|
| `getUsers(query: UserListQuery)` | `GET /api/users?page=&pageSize=&search=&sortBy=&sortDirection=` | `Observable<UserListResponse>` |
| `getUserById(id: string)` | `GET /api/users/:id` | `Observable<UserDto>` |
| `createUser(req: CreateUserRequest)` | `POST /api/users` | `Observable<UserDto>` |
| `updateUser(id: string, req: UpdateUserRequest)` | `PUT /api/users/:id` | `Observable<UserDto>` |
| `deleteUser(id: string)` | `DELETE /api/users/:id` | `Observable<{ message: string }>` |
| `toggleEnabled(id: string, enabled: boolean)` | `PATCH /api/users/:id/enabled` | `Observable<UserDto>` |

### Types
Defined in `src/app/features/users/types.ts` — see [API contract](../../../api-contract.md) for exact shapes.
