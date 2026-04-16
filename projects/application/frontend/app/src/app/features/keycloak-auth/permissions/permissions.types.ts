export type Permission =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'conversations:read'
  | 'conversations:write'
  | 'conversations:delete'
  | 'admin:access';

export type Role = 'admin' | 'user' | 'viewer';
