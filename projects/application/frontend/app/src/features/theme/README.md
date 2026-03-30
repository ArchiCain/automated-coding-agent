# Theme

Provides theme management and UI components for light/dark mode toggling with persistent user preferences.

## Purpose

The theme package encapsulates all theme-related functionality for the frontend application, including:
- Theme preference management (light/dark modes)
- Persistent storage of user theme preferences via API
- React hooks for consuming theme state
- Pre-built UI component for theme toggling
- Authentication-aware theme handling (local mode when not authenticated)

## Usage

### Using the Theme Toggle Component

```typescript
import { ThemeToggle } from '@packages/theme';

export function Header() {
  return (
    <header>
      <h1>My App</h1>
      <ThemeToggle size="medium" />
    </header>
  );
}
```

### Using the useTheme Hook

```typescript
import { useTheme } from '@packages/theme';

export function ThemeManager() {
  const { theme, toggleTheme, isLoading, error } = useTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Toggle Theme'}
      </button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </div>
  );
}
```

## API

| Export | Type | Description |
|--------|------|-------------|
| useTheme | Hook | Returns current theme mode, toggle function, loading state, and error state. Handles authentication-aware behavior and API synchronization. |
| ThemeToggle | Component | Pre-built icon button component for theme toggling with loading indicator. Supports configurable size. |
| ThemeApi | Object | Low-level API methods for fetching and updating theme preferences on the backend. |
| ThemePreference | Type | Interface for theme preference data with theme mode and userId. |
| UpdateThemeRequest | Type | Interface for theme update requests containing the desired theme mode. |

## Behavior

### useTheme Hook Returns

```typescript
interface UseThemeReturn {
  theme: 'light' | 'dark';           // Current theme mode
  toggleTheme: () => Promise<void>;   // Async function to toggle and persist theme
  isLoading: boolean;                 // True while API call is in progress
  error: string | null;               // Error message if toggle fails
}
```

### Authentication-Aware Behavior

- **When Authenticated**: Theme is fetched from server on mount and persisted via API calls
- **When Not Authenticated**: Theme switches locally only (defaults to dark mode)
- **On Error**: Falls back to previous theme and sets error message

### ThemeToggle Component Props

```typescript
interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';  // Button size (default: 'medium')
  className?: string;                    // Optional CSS class for styling
}
```

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports (useTheme, ThemeToggle, ThemeApi types) |
| use-theme.tsx | Custom React hook for theme state management and API integration |
| theme.api.ts | API client methods and TypeScript interfaces for theme endpoints |
| components/theme-toggle.tsx | Pre-built Material-UI button component for theme toggling |
| use-theme.test.tsx | Unit tests for useTheme hook behavior |
| theme.api.test.ts | Unit tests for ThemeApi methods |
| components/theme-toggle.test.tsx | Unit tests for ThemeToggle component |

## Dependencies

- **react** - Core React library for hooks and components
- **@mui/material** - Material-UI components (IconButton, Tooltip, CircularProgress)
- **@mui/icons-material** - Material-UI icons (LightMode, DarkMode)
- **@packages/mui-theme** - MUI theme context provider (useThemeContext)
- **@packages/keycloak-auth** - Authentication state (useAuth)
- **@packages/api-client** - HTTP client for API calls

## Integration Points

The theme package depends on and integrates with:

- **mui-theme package**: Provides the useThemeContext hook that manages the actual MUI theme mode
- **keycloak-auth package**: Used to determine if user is authenticated to decide between API persistence vs local storage
- **api-client package**: Used to communicate theme preferences with the backend API (/theme endpoint)
