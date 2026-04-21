import { Role } from '@features/keycloak-auth';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  roles: Role[];
  createdTimestamp?: number;
}

export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: Role;
}

export type SortDirection = 'asc' | 'desc';
export type UserSortField = 'username' | 'email' | 'firstName' | 'lastName' | 'createdTimestamp';

export interface UserListQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: UserSortField;
  sortDirection?: SortDirection;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserListResponse {
  users: User[];
  pagination: PaginationMeta;
}
