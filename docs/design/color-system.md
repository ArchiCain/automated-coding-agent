# Color System

Full color palette for the RTS AI Platform. Both light and dark mode palettes are defined.

## Light mode

### Primary

| Token | Value | Usage |
|-------|-------|-------|
| `primary.main` | `#007FFF` | Buttons, links, active states, focus rings |
| `primary.light` | `#66B2FF` | Hover states, selected backgrounds |
| `primary.dark` | `#0059B2` | Active/pressed states |
| `primary.contrastText` | `#FFFFFF` | Text on primary backgrounds |

### Secondary

| Token | Value | Usage |
|-------|-------|-------|
| `secondary.main` | `#0A1929` | Deep blue-gray accent |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `success.main` | `#1AA251` | Success indicators, positive actions |
| `success.light` | `#6AE79C` | Success backgrounds |
| `success.dark` | `#1AA251` | Success text on light backgrounds |
| `warning.main` | `#DEA500` | Warnings, caution states |
| `warning.light` | `#FFDC48` | Warning backgrounds |
| `warning.dark` | `#AB6800` | Warning text |
| `error.main` | `#EB0014` | Errors, destructive actions |
| `error.light` | `#FF99A2` | Error backgrounds |
| `error.dark` | `#C70011` | Error text |

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `background.default` | `#FFFFFF` | Page background |
| `background.paper` | `#FFFFFF` | Card/paper surfaces |
| `background.chat.user` | `#F3F6F9` | User chat message bubbles |
| `background.chat.assistant` | `#FFFFFF` | Assistant chat message area |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `text.primary` | `#1A2027` | Headings, body text |
| `text.secondary` | `#3E5060` | Captions, labels, secondary info |

### Dividers

| Token | Value |
|-------|-------|
| `divider` | `rgba(194, 224, 255, 0.08)` |

---

## Dark mode

### Primary

| Token | Value | Usage |
|-------|-------|-------|
| `primary.main` | `#ECECEC` | Buttons, links, active states |
| `primary.light` | `#FFFFFF` | Hover states |
| `primary.dark` | `#B4B4B4` | Active/pressed states |
| `primary.contrastText` | `#000000` | Text on primary backgrounds |

### Secondary

| Token | Value | Usage |
|-------|-------|-------|
| `secondary.main` | `#B2BAC2` | Light gray accent |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `success.main` | `#1DB45A` | Success indicators |
| `success.light` | `#6AE79C` | Success backgrounds |
| `success.dark` | `#1AA251` | Success text |
| `warning.main` | `#E9AB13` | Warnings |
| `warning.light` | `#FFDC48` | Warning backgrounds |
| `warning.dark` | `#AB6800` | Warning text |
| `error.main` | `#FF4C4F` | Errors |
| `error.light` | `#FF99A2` | Error backgrounds |
| `error.dark` | `#C70011` | Error text |

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `background.default` | `#212121` | Page background |
| `background.paper` | `#2A2A2A` | Card/paper surfaces |
| `background.chat.user` | `#343434` | User chat message bubbles |
| `background.chat.assistant` | `#2A2A2A` | Assistant chat message area |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `text.primary` | `#E7EBF0` | Headings, body text |
| `text.secondary` | `#B2BAC2` | Captions, labels, secondary info |

### Dividers

| Token | Value |
|-------|-------|
| `divider` | `rgba(194, 224, 255, 0.08)` |

---

## Focus / Interaction colors

| State | Color | Context |
|-------|-------|---------|
| Focus ring (inputs) | `#3399FF` | Text field focus border |
| Hover (icon buttons) | `rgba(51, 153, 255, 0.08)` | Subtle blue highlight |
| Hover shadow (buttons) | `rgba(51, 153, 255, 0.3)` | Button hover glow |

## Usage in Angular Material SCSS

These colors map to Angular Material's custom theme system. In SCSS theme files:

```scss
@use '@angular/material' as mat;

$light-theme: mat.define-theme((
  color: (
    theme-type: light,
    primary: mat.$blue-palette,  // Customized to #007FFF
  ),
));

$dark-theme: mat.define-theme((
  color: (
    theme-type: dark,
    primary: mat.$azure-palette,  // Customized to #ECECEC
  ),
));
```

Custom palette values that don't map directly to Material Design 3 tokens are defined as CSS custom properties and SCSS variables for use in component styles.
