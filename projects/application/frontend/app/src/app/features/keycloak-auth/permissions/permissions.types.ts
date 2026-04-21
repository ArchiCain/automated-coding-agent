export type Permission =
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'conversations:read'
  | 'conversations:create'
  | 'conversations:delete';

export type Role = 'admin' | 'user';
