# Login Page — Components

## LoginPage (`login.page.ts`)

The only component on this page. Self-contained — no child components needed.

**Selector:** `app-login-page`
**Standalone:** yes
**Change detection:** OnPush

### Imports
- `CommonModule`
- `ReactiveFormsModule`
- `MatCardModule`
- `MatFormFieldModule`
- `MatInputModule`
- `MatButtonModule`
- `MatProgressSpinnerModule`

### State
| Signal | Type | Purpose |
|--------|------|---------|
| `loading` | `signal<boolean>` | True while login request is in flight |
| `error` | `signal<string \| null>` | Error message from failed login |

### Form
```typescript
loginForm = this.fb.group({
  username: ['', [Validators.required, Validators.email]],
  password: ['', Validators.required],
});
```

Note: The form field is called `username` to match the API contract, but the label in the UI should say "Email" (Keycloak uses email as username).

### Dependencies
| Service | Methods used |
|---------|-------------|
| `AuthService` | `login()`, `isAuthenticated()` |
| `Router` | `navigate(['/home'])` |

### Layout

```
┌──────────────────────────────────────────────┐
│              #121212 background               │
│                                              │
│          ┌─────────────────────┐             │
│          │  #1e1e1e card       │             │
│          │  mat-elevation-z4   │             │
│          │                     │             │
│          │  Sign In (h2)       │             │
│          │                     │             │
│          │  [Email          ]  │             │
│          │  [Password       ]  │             │
│          │                     │             │
│          │  [  Sign In      ]  │             │
│          │                     │             │
│          │  Error text (red)   │             │
│          └─────────────────────┘             │
│                                              │
└──────────────────────────────────────────────┘
```

- Card max-width: 400px
- Card centered vertically and horizontally (flexbox on parent)
- Card padding: 24px
- Form fields: `appearance="outline"`, NO custom border-radius
- Button: full width, `mat-flat-button color="primary"`
- Error: red text below form, only visible when `error()` is not null
