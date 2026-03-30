import type { Role } from '../keycloak-auth/permissions/permissions.types';

/**
 * User - Full user representation for API responses
 * Matches backend: UserDto
 */
export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  roles: Role[];
}

/**
 * Create User Request - Request body for creating new users
 * Note: Email is used as the username in Keycloak
 * Matches backend: CreateUserDto
 */
export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}

/**
 * Update User Request - Request body for updating user details
 * Email/username is immutable after creation (Keycloak limitation)
 * Matches backend: UpdateUserDto
 */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: Role;
}

/**
 * Sort direction for list queries
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sortable fields for user list
 */
export type UserSortField = 'username' | 'email' | 'firstName' | 'lastName' | 'createdTimestamp';

/**
 * User List Query - Query parameters for listing users with pagination, search, and sorting
 * Matches backend: UserListQueryDto
 */
export interface UserListQuery {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Search term to filter users by username, email, firstName, or lastName */
  search?: string;
  /** Field to sort by */
  sortBy?: UserSortField;
  /** Sort direction */
  sortDirection?: SortDirection;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * User List Response - Paginated response for user listing
 * Matches backend: UserListResponseDto
 */
export interface UserListResponse {
  users: User[];
  pagination: PaginationMeta;
}

/**
 * Toggle User Enabled Request - Request body for enabling/disabling users
 * Matches backend: ToggleUserEnabledDto
 */
export interface ToggleUserEnabledRequest {
  enabled: boolean;
}
