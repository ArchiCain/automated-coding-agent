# App Header

Responsive application header component with integrated navigation, user authentication controls, and theme switching.

## Purpose

The app-header package provides a polished, sticky application header component that serves as the primary navigation and user control center for the frontend. It features a responsive design using Material-UI with support for light/dark themes, user authentication via Keycloak, and an integrated navigation menu drawer.

## Usage

```typescript
import { AppHeader } from '@packages/app-header';

export function App() {
  return (
    <>
      <AppHeader title="My Application" />
      {/* Page content */}
    </>
  );
}
```

### With Default Title

```typescript
import { AppHeader } from '@packages/app-header';

// Uses default title "Conversational AI"
<AppHeader />
```

### Custom Navigation Menu

```typescript
import { NavigationMenu } from '@packages/app-header';

const navigationTabs = [
  { id: 'home', name: 'Home', path: '/' },
  { id: 'about', name: 'About', path: '/about' },
  { id: 'dashboard', name: 'Dashboard', path: '/dashboard' },
];

<NavigationMenu
  tabs={navigationTabs}
  isOpen={isMenuOpen}
  onClose={() => setIsMenuOpen(false)}
  currentPath={location.pathname}
/>
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `AppHeader` | Component | Main sticky header component with branding, user controls, and theme toggle |
| `AppHeaderProps` | Interface | Props interface for AppHeader component |
| `NavigationMenu` | Component | Drawer-based left navigation menu |
| `NavigationMenuProps` | Interface | Props interface for NavigationMenu component |

## Features

- **Responsive Design**: Adapts layout for mobile, tablet, and desktop viewports
- **Sticky Positioning**: Stays at top of viewport while scrolling
- **Dark/Light Theme Support**: Integrates with theme package for seamless theme switching
- **User Authentication**: Displays user info and logout functionality via Keycloak
- **Smart Navigation**: Always-visible menu button for consistent navigation access
- **Professional Styling**: MUI X design aesthetic with backdrop blur effects and smooth transitions
- **User Avatar**: Displays user initials in avatar with responsive rendering

## Components

### AppHeader

The main header component rendered at the top of the application.

**Props:**
- `title` (optional): Header title. Defaults to "Conversational AI". Hidden on mobile viewports.

**Features:**
- Sticky header with blur backdrop effect
- Left-aligned menu toggle button
- Centered branding section with logo and title
- Right-aligned user controls:
  - User Chip (desktop view) with username and avatar
  - User Avatar (mobile view) with tooltip
  - Theme toggle button
  - Logout button

### NavigationMenu

Left drawer component for application navigation.

**Props:**
- `tabs`: Array of navigation tabs with `id`, `name`, and `path`
- `isOpen`: Boolean controlling drawer visibility
- `onClose`: Callback fired when menu should close
- `currentPath`: Current route path for active state highlighting

**Features:**
- Material-UI Drawer component
- Smart active state detection (handles root path correctly)
- Navigation via react-router-dom links
- Auto-closes on selection

### AvatarMenu

Reusable avatar menu component for dropdown menus.

**Props:**
- `isOpen`: Boolean controlling menu visibility
- `onToggle`: Callback to toggle menu state
- `children`: Menu content (MenuItem components)

**Features:**
- Click-outside detection to close menu
- Positioned relative to avatar
- Customizable menu content

## Dependencies

- `@mui/material` - Core UI components (AppBar, Toolbar, Avatar, etc.)
- `@mui/icons-material` - Icon components (Menu, Logout, AccountCircle)
- `react-router-dom` - Navigation and routing
- `@packages/theme` - Theme toggle and theme management
- `@packages/keycloak-auth` - User authentication and logout
- `@packages/layouts` - Layout context for drawer state management

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports for AppHeader and NavigationMenu components |
| `app-header.tsx` | Main header component with user controls and branding |
| `app-header.test.tsx` | Unit tests covering rendering, interactions, and styling |
| `types.ts` | TypeScript interface for AppHeaderProps |
| `navigation-menu/navigation-menu.tsx` | Left drawer navigation component |
| `navigation-menu/types.ts` | TypeScript interfaces for NavigationMenu |
| `avatar-menu/avatar-menu.tsx` | Dropdown avatar menu component |
| `avatar-menu/types.ts` | TypeScript interface for AvatarMenu |

## Design System

The header follows the MUI X design aesthetic with:

- **Colors**: Dark gradients for branding, semi-transparent backgrounds with blur effects
- **Spacing**: Responsive padding (xs: 2, sm: 3) with consistent gaps
- **Typography**: Bold gradient text for title (h6 variant, 700 weight)
- **Interactions**: Smooth transitions (0.2s-0.3s), scale and transform effects on hover
- **Accessibility**: Proper ARIA labels and semantic HTML structure

## Testing

The package includes comprehensive unit tests using Vitest and React Testing Library:

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

Tests cover:
- Default and custom title rendering
- Menu toggle interactions
- Theme toggle presence
- Logout functionality
- MUI styling application
- Viewport-specific behavior
