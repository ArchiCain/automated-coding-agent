# Layouts

Responsive application layout system with adaptive navigation and context-based state management.

## Purpose

The layouts package provides a complete layout infrastructure for the frontend application. It manages responsive design across mobile, tablet, and desktop breakpoints, handles navigation drawer behavior, and provides layout context for descendant components to adapt their behavior based on viewport and routing.

## Usage

### Basic Setup

Wrap your application with `LayoutProvider` to enable responsive layout management:

```typescript
import { LayoutProvider } from '@packages/layouts';

export default function App() {
  return (
    <LayoutProvider>
      <AppRoutes />
    </LayoutProvider>
  );
}
```

### Using AppLayout

Use `AppLayout` as your main layout wrapper for routed content:

```typescript
import { AppLayout } from '@packages/layouts';

<AppLayout title="My Page">
  <Outlet />
</AppLayout>
```

### Accessing Layout Context

Use the `useLayoutContext` hook in descendant components to respond to layout changes:

```typescript
import { useLayoutContext } from '@packages/layouts';

export function MyComponent() {
  const { isMobile, isDesktop, isLeftDrawerOpen, toggleLeftDrawer } = useLayoutContext();

  return (
    <div>
      {isMobile && <button onClick={toggleLeftDrawer}>Menu</button>}
    </div>
  );
}
```

### Conditional Chat Provider

Wrap your layout with `ChatProviderWrapper` to conditionally provide chat context only on the chat page:

```typescript
import { ChatProviderWrapper, LayoutProvider } from '@packages/layouts';

<ChatProviderWrapper>
  <LayoutProvider>
    <AppRoutes />
  </LayoutProvider>
</ChatProviderWrapper>
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `AppLayout` | Component | Main responsive layout component with header, sidebar, content area, and drawer |
| `AppLayoutProps` | Interface | Props for AppLayout: `children?`, `title?` |
| `LayoutProvider` | Component | Context provider managing responsive state and drawer behavior |
| `useLayoutContext` | Hook | Access layout context value (breakpoints, drawer state, page metadata) |
| `ChatProviderWrapper` | Component | Conditional chat context provider for chat page only |
| `LAYOUT_BREAKPOINTS` | Object | MUI breakpoint mappings (mobile: xs, tablet: sm, desktop: md) |
| `SIDEBAR_WIDTHS` | Object | Width constants for sidebars and drawers (left: 300px, right: 280px, drawer: 280px) |
| `HEADER_HEIGHT` | Constant | App header height (64px) |
| `CONTENT_MAX_WIDTH` | Object | Content width constraints (text: 70ch, container: 1200px) |
| `LAYOUT_Z_INDEX` | Object | Z-index layering (drawer: 1200, header: 1201) |

## Layout Context Value

The `useLayoutContext` hook returns an object with the following properties:

```typescript
interface LayoutContextValue {
  // Responsive breakpoint flags
  isMobile: boolean;      // true when viewport < 600px
  isTablet: boolean;      // true when viewport 600px - 899px
  isDesktop: boolean;     // true when viewport >= 900px

  // Drawer state
  isLeftDrawerOpen: boolean;
  toggleLeftDrawer: () => void;
  closeLeftDrawer: () => void;

  // Layout configuration
  isFullWidthPage: boolean;      // true for pages marked as full-width
  showPersistentLeftNav: boolean; // currently false (hamburger menu only)
}
```

## Responsive Behavior

The layouts package implements a three-tier responsive design strategy:

### Mobile (xs: 0-599px)
- Single column layout with header
- Navigation accessible via hamburger menu (drawer)
- Full-width content area

### Tablet (sm: 600-899px)
- Single column layout with header
- Navigation accessible via hamburger menu (drawer)
- Full-width content area

### Desktop (md: 900px+)
- Header spans full width
- Optional persistent sidebar (currently disabled)
- Hamburger menu navigation available via temporary drawer overlay
- Full-width or constrained content based on page metadata

## Breakpoint Configuration

Breakpoints align with Material-UI defaults:

```typescript
const LAYOUT_BREAKPOINTS = {
  mobile: 'xs',  // 0px
  tablet: 'sm',  // 600px
  desktop: 'md', // 900px
};
```

## Navigation Integration

The layouts package integrates with the navigation system to detect full-width pages:

- Checks navigation configuration to determine if current page should be full-width
- Pages marked with `metadata.fullWidth: true` render without persistent sidebar
- Drawer navigation available on all viewports via hamburger menu

## Dependencies

- **react** - UI library
- **react-router-dom** - Routing and path detection
- **@mui/material** - Material-UI components (Box, useTheme, useMediaQuery)
- **@packages/app-header** - Application header component
- **@packages/navigation** - Navigation sidebar and drawer components
- **@packages/navigation-config** - Navigation configuration and path resolution
- **@packages/mastra-agents** - Chat provider and services
- **@packages/keycloak-auth** - Authentication and user context

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports |
| `app-layout.tsx` | Main responsive layout component |
| `layout-context.tsx` | Layout context provider and hook |
| `ChatProviderWrapper.tsx` | Conditional chat context provider |
| `types.ts` | TypeScript type definitions |
| `breakpoint-config.ts` | Responsive breakpoint and dimension constants |
| `app-layout.test.tsx` | Unit tests for AppLayout component |

## Key Features

- **Responsive Breakpoints**: Mobile, tablet, and desktop layouts using MUI media queries
- **Context-Driven**: Layout state accessible throughout the application via React Context
- **Drawer Management**: Automatic drawer opening/closing on viewport changes and route navigation
- **Full-Width Pages**: Metadata-driven detection of pages that should span full width
- **Chat Integration**: Conditional chat provider that wraps chat page only
- **Thread Management**: Session storage based thread ID management for chat conversations
- **Accessibility**: Proper semantic HTML with flexbox layout structure

## Notes

- The persistent left navigation is currently disabled (`showPersistentLeftNav = false`)
- Navigation is accessed via hamburger menu on all viewports
- Drawers automatically close when switching to desktop viewport
- Drawers automatically close when navigating to a new route
- Chat context is only provided when on chat page (/) with authenticated user
