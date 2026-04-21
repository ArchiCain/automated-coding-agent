# User Management — Contracts

## Endpoints

### `GET /users`
**Auth:** JWT + `users:read` permission
**Query Parameters:**
```typescript
{
  page?: number;        // default: 1
  pageSize?: number;    // default: 10
  search?: string;      // searches username, email, firstName, lastName
  sortBy?: string;      // field name to sort by
  sortDirection?: 'asc' | 'desc';  // default: 'asc'
}
```
**Response (200):**
```typescript
{
  users: UserDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

### `GET /users/:id`
**Auth:** JWT + `users:read` permission
**Response (200):**
```typescript
UserDto
```
**Error (404):**
```typescript
{ statusCode: 404; message: "User not found" }
```

### `POST /users`
**Auth:** JWT + `users:create` permission
**Request:**
```typescript
{
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: 'admin' | 'user';
}
```
**Response (201):**
```typescript
UserDto
```
**Error (400):**
```typescript
{ statusCode: 400; message: "User with this username or email already exists" }
```

### `PUT /users/:id`
**Auth:** JWT + `users:update` permission
**Request:**
```typescript
{
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user';
}
```
**Response (200):**
```typescript
UserDto
```

### `DELETE /users/:id`
**Auth:** JWT + `users:delete` permission
**Response (200):**
```typescript
{ message: "User deleted successfully" }
```

### `PATCH /users/:id/enabled`
**Auth:** JWT + `users:update` permission
**Request:**
```typescript
{ enabled: boolean }
```
**Response (200):**
```typescript
UserDto
```

## Shared Types

```typescript
interface UserDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  createdTimestamp: number;
  roles: string[];
}

interface PaginatedUsersResponse {
  users: UserDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: 'admin' | 'user';
}

interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user';
}
```
