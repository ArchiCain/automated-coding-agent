# Welcome Page — Components

## HomePage (`home.page.ts`)

The page component. Renders the greeting and a grid of feature cards.

**Selector:** `app-home-page`
**Standalone:** yes
**Change detection:** OnPush

### Dependencies
| Service | Methods/signals used |
|---------|---------------------|
| `AuthService` | `user()` for greeting, `hasPermission$('users:read')` for card visibility |

### Template structure
```html
<h1>Welcome, {{ user()?.firstName || user()?.username }}</h1>
<p>Brief intro text about the application</p>

<div class="feature-grid">
  <app-feature-card ... />  <!-- User Management (conditional) -->
  <app-feature-card ... />  <!-- Smoke Tests -->
</div>
```

---

## FeatureCard (`feature-card.component.ts`)

Reusable card that displays a feature with icon, title, description, and navigates on click.

**Selector:** `app-feature-card`
**Standalone:** yes
**Change detection:** OnPush
**Location:** `src/app/features/home/components/feature-card/`

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| `icon` | `string` | Material icon name (e.g. `'people'`, `'monitor_heart'`) |
| `title` | `string` | Card heading (e.g. "User Management") |
| `description` | `string` | Short description |
| `route` | `string` | Route to navigate to on click |

### Behavior
- Entire card is clickable (navigate via `Router`)
- Hover state: background changes to `$background-hover` (#2a2a2a dark / #f5f5f5 light)
- Uses `mat-card` with `mat-elevation-z2`
- Icon: `mat-icon` at 48px size, accent color

### Feature cards

| Icon | Title | Description | Route | Visibility |
|------|-------|-------------|-------|------------|
| `people` | User Management | Manage users, roles, and permissions | `/users` | `hasPermission$('users:read')` |
| `monitor_heart` | Smoke Tests | Check backend service health status | `/smoke-tests` | Always visible |
