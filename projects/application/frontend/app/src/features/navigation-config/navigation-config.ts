import ChatIcon from '@mui/icons-material/Chat';
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
      id: 'conversational-ai',
      label: 'Conversational AI',
      path: '/',
      icon: ChatIcon,
      metadata: {
        description: 'Chat with AI assistants',
        fullWidth: true, // Hide left nav for immersive chat experience
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
