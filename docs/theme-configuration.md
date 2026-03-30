# Theme & Branding Configuration

This document defines the visual branding for the application.
Modify these values once during project setup for client customization.

---

## Brand Identity

- **App Name**: `"RTS AI Platform"`
- **Primary Color**: `#1976d2` (Material Blue)
- **Secondary Color**: `#dc004e` (Material Pink)
- **Logo URL**: `"/logo.svg"` (place in `public/` directory)

---

## Theme Mode

- **Default Mode**: `dark`
- **Available Modes**: `light`, `dark` (user-toggleable via theme API)

---

## For Developers

These values are read by `projects/frontend/app/src/packages/mui-theme/branding-config.ts`.

Material Design 3 handles all other styling automatically. Do not override MUI defaults unless absolutely necessary.

### Updating Branding

1. Edit values above
2. Update `packages/mui-theme/branding-config.ts` with new values
3. Rebuild frontend: `task frontend:local:restart`

---

## Material Design Resources

- [Material Design 3 Guidelines](https://m3.material.io/)
- [MUI Documentation](https://mui.com/material-ui/)
- [Color Tool](https://m2.material.io/resources/color/)
