# Benchmark Frontend — Design Specification

## Design Philosophy

Strictly Material Design via Angular Material. No custom component library. No CSS frameworks. No gradients, glows, particles, or decorative elements. The UI should look like a well-built internal tool — clean, professional, boring.

---

## Theme

Supports both dark and light modes. User preference is stored server-side via `/api/theme`. Default to dark if no preference exists.

### Color Palette — Dark Mode

```scss
// Background hierarchy (darkest to lightest)
$background-page:    #121212;   // Page/body background
$background-surface: #1e1e1e;   // Cards, dialogs, sidenav
$background-hover:   #2a2a2a;   // Hover states on surfaces
$background-input:   #1e1e1e;   // Form field backgrounds (same as surface)

// Text hierarchy
$text-primary:       #ffffff;                    // Headings, primary content
$text-secondary:     rgba(255, 255, 255, 0.7);   // Labels, secondary content
$text-disabled:      rgba(255, 255, 255, 0.38);  // Disabled/placeholder text
$text-hint:          rgba(255, 255, 255, 0.5);   // Hints, captions
```

### Color Palette — Light Mode

```scss
// Background hierarchy
$background-page:    #fafafa;   // Page/body background
$background-surface: #ffffff;   // Cards, dialogs, sidenav
$background-hover:   #f5f5f5;   // Hover states on surfaces
$background-input:   #ffffff;   // Form field backgrounds

// Text hierarchy
$text-primary:       rgba(0, 0, 0, 0.87);   // Headings, primary content
$text-secondary:     rgba(0, 0, 0, 0.6);    // Labels, secondary content
$text-disabled:      rgba(0, 0, 0, 0.38);   // Disabled/placeholder text
$text-hint:          rgba(0, 0, 0, 0.5);    // Hints, captions
```

### Shared Colors (both themes)

```scss
// Borders and dividers
$divider:            rgba(255, 255, 255, 0.12);  // Dark mode
$divider-light:      rgba(0, 0, 0, 0.12);        // Light mode

// Accent (use sparingly — only for interactive elements)
$accent-primary:     #90caf9;   // Primary buttons, active nav items, links
$accent-hover:       #bbdefb;   // Hover on accent elements

// Status colors (same in both themes)
$status-success:     #66bb6a;   // Green — healthy, success, up, enabled
$status-warning:     #ffa726;   // Orange — degraded, warning
$status-error:       #ef5350;   // Red — error, down, failed, disabled
$status-info:        #42a5f5;   // Blue — info badges

// Role badge colors
$role-admin:         #42a5f5;   // Blue chip
$role-user:          #78909c;   // Gray chip
```

### Angular Material Theme Setup

```scss
// In styles.scss — define BOTH themes
@use '@angular/material' as mat;

// Dark theme
$dark-theme: mat.define-dark-theme((
  color: (
    primary: mat.define-palette(mat.$blue-palette, 200),
    accent: mat.define-palette(mat.$blue-grey-palette, 200),
    warn: mat.define-palette(mat.$red-palette),
  ),
));

// Light theme
$light-theme: mat.define-light-theme((
  color: (
    primary: mat.define-palette(mat.$blue-palette, 700),
    accent: mat.define-palette(mat.$blue-grey-palette, 700),
    warn: mat.define-palette(mat.$red-palette),
  ),
));

// Default: dark
@include mat.all-component-themes($dark-theme);

// Light mode override via class on root element
.theme-light {
  @include mat.all-component-colors($light-theme);
  background: #fafafa;
  color: rgba(0, 0, 0, 0.87);
}

body {
  margin: 0;
  background: #121212;
  color: #ffffff;
  font-family: Roboto, sans-serif;
}

body.theme-light {
  background: #fafafa;
  color: rgba(0, 0, 0, 0.87);
}
```

### Theme Switching

The `ThemeService` applies `theme-light` or `theme-dark` class to the `<body>` element. The root `app.component.ts` subscribes to the theme signal and updates the class.

### CRITICAL: What NOT to Do

1. **Do NOT set `border-radius` on `mat-form-field` or its internal elements.** Angular Material's MDC notched outline is composed of 3 SVG segments (leading, notch, trailing). Setting border-radius on these segments individually creates a scalloped/broken appearance. Leave them at the Material default (4px).

2. **Do NOT override Material component geometry** (padding, margins, heights) unless absolutely necessary. Override colors and borders only.

3. **Do NOT use `::ng-deep`** unless there is no other way to reach a Material internal element. Prefer the theme system and CSS custom properties.

4. **Do NOT set `box-shadow` on cards** — use `mat-elevation-z2` or `mat-elevation-z4` classes instead.

5. **Do NOT add `border-radius` to global styles** for Material components. The default 4px is correct.

---

## Layout

### Page Structure

```
┌──────────────────────────────────────────────┐
│ mat-sidenav-container (full viewport)        │
│ ┌────────────┐ ┌───────────────────────────┐ │
│ │ mat-sidenav│ │ mat-sidenav-content       │ │
│ │            │ │                           │ │
│ │ Navigation │ │  Page content             │ │
│ │            │ │  (padding: 24px)          │ │
│ │            │ │                           │ │
│ │            │ │                           │ │
│ │ Theme tog. │ │                           │ │
│ │ User info  │ │                           │ │
│ │ Logout btn │ │                           │ │
│ └────────────┘ └───────────────────────────┘ │
└──────────────────────────────────────────────┘
```

- **Sidenav width:** 240px
- **Sidenav mode:** `side` on desktop (>960px), `over` on mobile
- **Content padding:** 24px
- **Max content width:** none (fluid)

### Login Page (no sidenav)

```
┌──────────────────────────────────────────────┐
│                                              │
│                                              │
│          ┌─────────────────────┐             │
│          │  Sign In            │             │
│          │                     │             │
│          │  [Email          ]  │             │
│          │  [Password       ]  │             │
│          │                     │             │
│          │  [ Sign In       ]  │             │
│          │                     │             │
│          │  Error message      │             │
│          └─────────────────────┘             │
│                                              │
└──────────────────────────────────────────────┘
```

- **Card max-width:** 400px
- **Card centered:** vertically and horizontally (flexbox)
- **Card background:** #1e1e1e (dark) / #ffffff (light)
- **Card elevation:** mat-elevation-z4

---

## Typography

Use Angular Material's typography system. No custom font sizes.

| Element | Material class | Size |
|---------|---------------|------|
| Page heading | `mat-headline-5` | 24px |
| Card heading | `mat-headline-6` | 20px |
| Body text | `mat-body-1` | 16px |
| Caption/secondary | `mat-caption` | 12px |
| Button text | default mat-button | 14px |

---

## Component Patterns

### Buttons

| Type | Usage | Style |
|------|-------|-------|
| `mat-flat-button color="primary"` | Primary actions (Sign In, Create User, Check Now) | Filled blue |
| `mat-button` | Secondary actions (Cancel, Close) | Text only |
| `mat-icon-button` | Icon-only actions (menu toggle, refresh, delete) | Icon only |
| `mat-stroked-button` | Tertiary actions (Edit) | Outlined |

### Form Fields

```html
<mat-form-field appearance="outline">
  <mat-label>Email</mat-label>
  <input matInput formControlName="email" />
  <mat-error *ngIf="...">Required</mat-error>
</mat-form-field>
```

- Always use `appearance="outline"`
- Never set custom `border-radius`
- Use `mat-error` for validation messages
- Use `mat-hint` for helper text

### Cards

```html
<mat-card>
  <mat-card-header>
    <mat-card-title>Title</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    Content here
  </mat-card-content>
</mat-card>
```

- Background: inherits from theme
- Use `class="mat-elevation-z2"` for subtle elevation
- No custom border-radius (Material default is fine)

### Tables

```html
<table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSort($event)">
  <ng-container matColumnDef="email">
    <th mat-header-cell *matHeaderCellDef mat-sort-header>Email</th>
    <td mat-cell *matCellDef="let row">{{ row.email }}</td>
  </ng-container>
  <!-- ... -->
  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns" (click)="openDetail(row)"></tr>
</table>
<mat-paginator [length]="totalItems" [pageSize]="pageSize" [pageSizeOptions]="[5, 10, 25]"
               (page)="onPage($event)"></mat-paginator>
```

- matSort triggers server-side sort (not client-side)
- mat-paginator triggers server-side pagination
- Row click handler for detail views

### Dialogs

```typescript
this.dialog.open(UserDetailDialog, {
  width: '480px',
  data: { user: row },
});
```

- Width: 400-600px depending on content
- Always have a close button (X icon in top-right)
- Use `mat-dialog-title`, `mat-dialog-content`, `mat-dialog-actions`

### Confirm Dialog

For destructive actions (delete user):

```html
<h2 mat-dialog-title>Confirm Delete</h2>
<mat-dialog-content>
  Are you sure you want to delete this user? This will disable their account.
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button mat-dialog-close>Cancel</button>
  <button mat-flat-button color="warn" (click)="confirm()">Delete</button>
</mat-dialog-actions>
```

### Status Indicators

```html
<span class="status-dot" [class.up]="status === 'ok'" [class.down]="status !== 'ok'"></span>
```

```scss
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  &.up { background: #66bb6a; }
  &.down { background: #ef5350; }
}
```

Also used for user enabled/disabled status:
- Enabled: green dot or `mat-slide-toggle` checked
- Disabled: red dot or `mat-slide-toggle` unchecked

### Role Badges

```html
<mat-chip [class]="'role-' + user.roles[0]">{{ user.roles[0] }}</mat-chip>
```

```scss
.role-admin {
  background: #42a5f5 !important;
  color: white !important;
}
.role-user {
  background: #78909c !important;
  color: white !important;
}
```

### Loading States

- Use `mat-spinner` (diameter="20" for inline, default for full-page)
- For tables: show skeleton rows or centered spinner
- For cards: show `mat-progress-bar mode="indeterminate"` at top of card

### Snackbar (Feedback Toast)

```typescript
// Success
this.snackBar.open('User created successfully', 'Dismiss', { duration: 3000 });

// Error
this.snackBar.open('Something went wrong', 'Dismiss', {
  duration: 5000,
  panelClass: ['error-snackbar'],
});
```

### Theme Toggle

In the sidenav footer, use a `mat-slide-toggle`:

```html
<mat-slide-toggle [checked]="isDarkMode()" (change)="toggleTheme()">
  Dark Mode
</mat-slide-toggle>
```

---

## Spacing

Use multiples of 8px consistently.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Dense internal spacing |
| sm | 8px | Between related elements |
| md | 16px | Between groups |
| lg | 24px | Page padding, section gaps |
| xl | 32px | Large section separators |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout change |
|------------|-------|---------------|
| Mobile | <600px | Sidenav becomes overlay drawer, single column cards |
| Tablet | 600-960px | Sidenav overlay, 2 column cards |
| Desktop | >960px | Sidenav side mode, 3 column cards |

Use Angular CDK `BreakpointObserver` for responsive logic:

```typescript
private breakpointObserver = inject(BreakpointObserver);

isMobile$ = this.breakpointObserver.observe([Breakpoints.Handset])
  .pipe(map(result => result.matches));
```
