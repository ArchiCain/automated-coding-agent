import { useLocation } from 'react-router-dom';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { NavigationItem } from '@/features/navigation-config';
import { usePermission } from '@/features/keycloak-auth';

interface NavigationTreeProps {
  items: NavigationItem[];
}

/**
 * NavigationTree
 *
 * Simple flat navigation component for rendering navigation links.
 * Supports icons, active state highlighting, and permission-based visibility.
 */
export function NavigationTree({ items }: NavigationTreeProps) {
  const location = useLocation();
  const { hasPermission } = usePermission();

  // Filter items based on required permissions
  const visibleItems = items.filter((item) => {
    if (item.metadata?.requiredPermission) {
      return hasPermission(item.metadata.requiredPermission);
    }
    return true;
  });

  return (
    <List dense disablePadding>
      {visibleItems.map((item) => {
        // Determine if this item is active
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path || '');

        const isNavigable = Boolean(item.path) && !item.metadata?.disabled;

        return (
          <ListItemButton
            key={item.id}
            component={isNavigable ? Link : 'div'}
            to={isNavigable ? item.path : undefined}
            selected={isActive}
            sx={{
              pl: 2,
              py: 0.75,
              borderRadius: 1,
              mb: 0.5,
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              borderLeft: isActive ? 3 : 0,
              borderColor: 'primary.main',
              '&.Mui-selected': {
                bgcolor: 'action.selected',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              },
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {item.icon && (
              <ListItemIcon sx={{ minWidth: 40 }}>
                <item.icon fontSize="small" />
              </ListItemIcon>
            )}

            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
