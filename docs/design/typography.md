# Typography

Typography scale and conventions for the RTS AI Platform.

## Font stack

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"
```

System font stack — no custom web fonts to load. Fast, native-feeling, consistent with the OS.

## Type scale

| Level | Size | Weight | Line height | Letter spacing | Notes |
|-------|------|--------|-------------|----------------|-------|
| **h1** | `clamp(2.625rem, 1.2857rem + 3.5714vw, 4rem)` | 800 | 1.114 | -0.02em | Responsive: 42px to 64px |
| **h2** | `clamp(1.5rem, 0.9643rem + 1.4286vw, 2.25rem)` | 700 | 1.222 | -0.015em | Responsive: 24px to 36px |
| **h3** | 2.25rem (36px) | 600 | 1.222 | -0.01em | |
| **h4** | 1.75rem (28px) | 600 | 1.4 | -0.005em | |
| **h5** | 1.5rem (24px) | 600 | 1.5 | — | |
| **h6** | 1.25rem (20px) | 600 | 1.5 | — | |
| **body1** | 1rem (16px) | 400 | 1.625 | — | Default body text |
| **body2** | 0.875rem (14px) | 400 | 1.57 | — | Secondary body text |
| **button** | 0.875rem (14px) | 700 | — | 0.02em | No text-transform (no uppercase) |
| **caption** | 0.75rem (12px) | 400 | 1.66 | — | Labels, timestamps, metadata |

## Responsive headings

`h1` and `h2` use CSS `clamp()` for fluid responsive sizing. This means:
- On small screens (mobile), headings are smaller
- On large screens (desktop), headings scale up
- Scaling is smooth, not breakpoint-based jumps

## Weight usage

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text, captions |
| Semi-bold | 600 | Headings h3-h6, chips |
| Bold | 700 | Buttons, h2, emphasis |
| Extra-bold | 800 | h1 only |

## Button text

Buttons use `text-transform: none` — no uppercase. This is intentional. All-caps button text is harder to read and feels aggressive. Buttons use weight (700) and letter-spacing (0.02em) for emphasis instead.

## Angular Material integration

These values are configured in the Angular Material theme via the `typography` configuration:

```scss
@use '@angular/material' as mat;

$typography: mat.define-typography-config(
  $font-family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  $headline-1: mat.define-typography-level(clamp(2.625rem, 1.2857rem + 3.5714vw, 4rem), 1.114, 800, $letter-spacing: -0.02em),
  $headline-2: mat.define-typography-level(clamp(1.5rem, 0.9643rem + 1.4286vw, 2.25rem), 1.222, 700, $letter-spacing: -0.015em),
  $headline-3: mat.define-typography-level(2.25rem, 1.222, 600, $letter-spacing: -0.01em),
  // ... etc
);
```

The exact mapping between these custom levels and Angular Material's M3 type tokens is handled in the theme files.

## Usage guidelines

- Use **one heading level per section** — don't skip levels (h1 then h3)
- **body1** for primary content, **body2** for secondary/supporting content
- **caption** for metadata: timestamps, record counts, status labels
- Don't use font size directly in component styles — use the type scale via Material's `typography` mixin or the theme tokens
