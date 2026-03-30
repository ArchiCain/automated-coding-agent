import { Role } from '../keycloak-auth/permissions/permissions.types';

/**
 * User DTO - Full user representation for API responses
 */
export interface UserDto {
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
 * Create User DTO - Request body for creating new users
 * Note: Email is used as the username in Keycloak
 */
export interface CreateUserDto {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}

/**
 * Update User DTO - Request body for updating user details
 * Email/username is immutable after creation (Keycloak limitation)
 */
export interface UpdateUserDto {
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
 * User List Query DTO - Query parameters for listing users with pagination, search, and sorting
 */
export interface UserListQueryDto {
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
 * User List Response DTO - Paginated response for user listing
 */
export interface UserListResponseDto {
  users: UserDto[];
  pagination: PaginationMeta;
}

/**
 * Toggle User Enabled DTO - Request body for enabling/disabling users
 */
export interface ToggleUserEnabledDto {
  enabled: boolean;
}
