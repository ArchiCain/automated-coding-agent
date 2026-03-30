import { SvgIconProps } from '@mui/material';
import type { Permission } from '../keycloak-auth/permissions/permissions.types';

/**
 * Metadata for navigation items
 */
export interface NavigationItemMetadata {
  /** Short description shown in tooltips/secondary text */
  description?: string;

  /** Badge text to display (e.g., "New", "Beta") */
  badge?: string;

  /** Disable navigation to this item */
  disabled?: boolean;

  /** Hide the persistent left navigation for this page (e.g., chat page) */
  fullWidth?: boolean;

  /** Permission required to view this navigation item */
  requiredPermission?: Permission;
}

/**
 * A single item in the navigation tree
 */
export interface NavigationItem {
  /** Unique identifier for this navigation item */
  id: string;

  /** Display label */
  label: string;

  /** Route path (if this is a navigable item) */
  path?: string;

  /** MUI icon component */
  icon?: React.ComponentType<SvgIconProps>;

  /** Child navigation items (for hierarchical navigation) */
  children?: NavigationItem[];

  /** Additional metadata */
  metadata?: NavigationItemMetadata;
}

/**
 * Complete navigation configuration
 */
export interface NavigationConfig {
  /** Root navigation items */
  items: NavigationItem[];

  /** Maximum supported nesting depth */
  maxDepth: number;
}
