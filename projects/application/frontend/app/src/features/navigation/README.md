# Navigation

Responsive navigation components for the frontend application, providing both persistent sidebar and mobile drawer navigation UIs.

## Purpose

This package provides reusable React navigation components that adapt to different screen sizes. It includes:

- **Persistent sidebar** for desktop viewports with hierarchical navigation tree
- **Mobile/tablet drawer** that overlays content when opened
- **Hierarchical navigation tree** with permission-based visibility and active state highlighting

These components integrate with the layout system and support permission-based access control through Keycloak authentication.

## Usage

Import the components from the navigation package:

```typescript
import {
  NavigationTree,
  LeftNavigationSidebar,
  LeftNavigationDrawer,
} from '@packages/navigation';

// In your layout component
export function AppLayout() {
  return (
    <Box sx={{ display: 'flex' }}>
      {/* Persistent sidebar for desktop */}
      <LeftNavigationSidebar />

      {/* Mobile drawer overlay */}
      <LeftNavigationDrawer />

      {/* Main content */}
      <Box sx={{ flex: 1 }}>
        {/* page content */}
      </Box>
    </Box>
  );
}
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `LeftNavigationSidebar` | Component | Persistent navigation sidebar for desktop viewports. Positioned below the header with automatic height calculation. |
| `LeftNavigationDrawer` | Component | Temporary overlay drawer for mobile and tablet viewports. Opens from the left side and closes on backdrop click. |
| `NavigationTree` | Component | Hierarchical navigation list that renders navigation items with icons, active state highlighting, and permission filtering. |

## Components

### LeftNavigationSidebar

Persistent drawer displayed on desktop viewports. Features:

- Permanent drawer variant
- Positioned below header with automatic height calculation
- Scrollable content area
- Right border divider
- Uses configured sidebar width
- Renders `NavigationTree` with items from navigation config

Props: None (uses layout context and navigation config)

### LeftNavigationDrawer

Mobile/tablet drawer that overlays content when opened. Features:

- Temporary drawer variant
- Opens from the left side
- Header with title and close button
- Divider between header and navigation
- Configured drawer width
- Better mobile performance with `keepMounted`
- Renders `NavigationTree` with items from navigation config
- Controlled via `useLayoutContext` hook

Props: None (uses layout context and navigation config)

### NavigationTree

Core navigation list component that renders navigation items. Features:

- Renders flat list of navigation items
- Displays icons from item configuration
- Active state detection based on current route
- Permission-based item filtering
- Click to navigate using React Router
- Smooth transitions on hover and active states
- Left border indicator for active items
- Responsive font weights (bold when active)

Props:

```typescript
interface NavigationTreeProps {
  items: NavigationItem[];  // Array of navigation items to display
}
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@mui/material` | Material-UI components (Drawer, List, Box, etc.) |
| `@mui/icons-material` | Material design icons |
| `react-router-dom` | Route detection and navigation links |
| `@packages/navigation-config` | Navigation item configuration and types |
| `@packages/layouts` | Layout context and sidebar width constants |
| `@packages/keycloak-auth` | Permission checking via `usePermission` hook |

## Configuration

Navigation items are defined in the `navigation-config` package and passed to the components. Items support:

- **id**: Unique identifier
- **label**: Display text
- **path**: Route path for navigation
- **icon**: MUI icon component
- **children**: Child navigation items (for future hierarchical support)
- **metadata**: Additional configuration
  - `requiredPermission`: Permission needed to view item
  - `disabled`: Disable navigation to this item
  - `description`: Tooltip text
  - `badge`: Badge text (e.g., "New")
  - `fullWidth**: Hide sidebar on this route

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports (NavigationTree, LeftNavigationSidebar, LeftNavigationDrawer) |
| `NavigationTree.tsx` | Hierarchical navigation list component with permission filtering |
| `LeftNavigationSidebar.tsx` | Persistent sidebar for desktop viewports |
| `LeftNavigationDrawer.tsx` | Mobile/tablet overlay drawer |
