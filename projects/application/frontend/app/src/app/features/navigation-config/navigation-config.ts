import { NavigationConfig } from './types';

export const navigationConfig: NavigationConfig = {
  items: [
    {
      id: 'smoke-tests',
      label: 'Smoke Tests',
      icon: 'science',
      route: '/smoke-tests',
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: 'chat',
      route: '/chat',
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: 'admin_panel_settings',
      children: [
        {
          id: 'users',
          label: 'Users',
          icon: 'people',
          route: '/admin/users',
          permission: 'users:read',
        },
      ],
    },
  ],
};
