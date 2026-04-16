import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ScienceIcon from '@mui/icons-material/Science';
import type { NavigationConfig } from './types';

/**
 * Centralized navigation configuration
 *
 * Flat navigation structure with direct links to main pages.
 */
export const navigationConfig: NavigationConfig = {
  maxDepth: 1,
  items: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: DashboardIcon,
      metadata: {
        description: 'Main dashboard with system overview and quick actions',
      },
    },
    {
      id: 'smoke-tests',
      label: 'Smoke Tests',
      path: '/smoke-tests',
      icon: ScienceIcon,
      metadata: {
        description: 'System health checks and diagnostics',
      },
    },
    {
      id: 'user-management',
      label: 'User Management',
      path: '/admin/users',
      icon: PeopleIcon,
      metadata: {
        description: 'Manage users and permissions',
        requiredPermission: 'users:read',
      },
    },
  ],
};
