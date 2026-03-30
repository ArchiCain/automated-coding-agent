# mui-theme

Centralized Material-UI theme configuration and provider for the RTS AI Platform frontend application.

## Purpose

This package provides a complete theming solution for the frontend application using Material-UI (MUI). It exports pre-configured light and dark themes with custom components, typography, color palettes, and shadows inspired by MUI X design system. The package also includes a React context-based theme provider for dynamic theme switching between light and dark modes.

## Usage

### Setup

Wrap your application with the MuiThemeProvider at the root level:

```typescript
import { MuiThemeProvider } from '@packages/mui-theme';

function App() {
  return (
    <MuiThemeProvider>
      {/* Your application components */}
    </MuiThemeProvider>
  );
}
```

### Access Theme Context

Use the useThemeContext hook to access theme mode and toggle functionality within your components:

```typescript
import { useThemeContext } from '@packages/mui-theme';

function ThemeToggle() {
  const { mode, toggleTheme, setMode } = useThemeContext();

  return (
    <button onClick={toggleTheme}>
      Switch from {mode} to {mode === 'light' ? 'dark' : 'light'}
    </button>
  );
}
```

### Use Themes Directly

Import the pre-configured themes for use outside React context or for extending:

```typescript
import { lightTheme, darkTheme } from '@packages/mui-theme';

// Use themes directly in ThemeProvider
<ThemeProvider theme={lightTheme}>
  {/* Components */}
</ThemeProvider>
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `MuiThemeProvider` | React Component | Context provider that enables theme switching. Manages light/dark mode state and applies theme globally. |
| `useThemeContext` | React Hook | Access current theme mode, toggle function, and set mode function. Must be used within MuiThemeProvider. |
| `lightTheme` | MUI Theme | Pre-configured light theme with vibrant blue primary colors and light backgrounds. |
| `darkTheme` | MUI Theme | Pre-configured dark theme with neutral grays and dark backgrounds, includes custom scrollbar styles. |
| `brandingConfig` | Object | Application branding configuration including app name, colors, and logo URL. |

## Theme Features

### Light Theme
- Primary color: #007FFF (vibrant MUI blue)
- Secondary color: #0A1929 (deep blue-gray)
- White backgrounds for clean, bright appearance
- Custom chat message colors (user: light gray-blue, assistant: white)

### Dark Theme
- Primary color: #ECECEC (neutral light gray)
- Secondary color: #B2BAC2 (light gray)
- Dark backgrounds (#212121, #2A2A2A) for reduced eye strain
- Custom chat message colors (user: dark gray, assistant: slightly lighter gray)
- Styled scrollbars with custom dark theme colors

### Component Customizations
Both themes include style overrides for:
- **MuiButton**: Rounded corners, smooth transitions, lift effect on hover
- **MuiCard**: Rounded corners, lift effect on hover, smooth transitions
- **MuiPaper**: Custom elevation shadows
- **MuiTextField**: Rounded corners, smooth focus transitions
- **MuiAppBar**: Subtle bottom border
- **MuiDrawer**: Border styling
- **MuiIconButton**: Rounded corners, scale effect on hover
- **MuiChip**: Rounded corners, bold font weight

### Typography Scale
Based on MUI X design system with responsive sizing using CSS clamp():
- Headings (h1-h6): Responsive font sizes with refined line heights and letter spacing
- Body text (body1, body2): Optimized readability
- Button: Uppercase transformation disabled, increased letter spacing
- Caption: Fine print sizing

### Spacing & Border Radius
- Base spacing unit: 8px
- Border radius: 10px default (12px for cards)
- Smooth transitions: 150ms to 375ms depending on use case

## Configuration

Update the branding configuration in `branding-config.ts`:

```typescript
export const brandingConfig = {
  appName: 'RTS AI Platform',
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  logoUrl: '/logo.svg',
} as const;
```

## Custom Type Extensions

The package extends MUI's TypeScript definitions to support custom chat message background colors:

```typescript
// Available in theme.palette.background.chat
{
  user: string;      // Background color for user messages
  assistant: string; // Background color for assistant messages
}
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports (MuiThemeProvider, useThemeContext, themes, branding config) |
| `theme-provider.tsx` | React component and hook for theme context management |
| `theme-config.ts` | Light and dark theme configurations with component overrides |
| `branding-config.ts` | Application branding configuration (app name, colors, logo) |

## Dependencies

- **@mui/material** (^6.5.0) - Material Design component library and theme engine
- **@emotion/react** (^11.14.0) - CSS-in-JS styling library for MUI
- **@emotion/styled** (^11.14.1) - Styled components utility for Emotion
- **react** (^19.1.0) - React context and hooks

## Related Documentation

For theme customization details, see `docs/theme-configuration.md` in the parent project.
