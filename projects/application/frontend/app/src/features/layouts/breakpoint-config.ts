/**
 * Layout Breakpoint Configuration
 *
 * Defines responsive breakpoints and layout constants matching
 * Material-UI's documentation website structure.
 *
 * Breakpoints align with MUI defaults:
 * - xs: 0px (mobile)
 * - sm: 600px (tablet)
 * - md: 900px (desktop)
 * - lg: 1200px (large desktop)
 * - xl: 1536px (extra large)
 */

/**
 * Layout breakpoint identifiers
 * Maps to MUI theme breakpoint keys
 */
export const LAYOUT_BREAKPOINTS = {
  /** Mobile: 0-599px - Single column, drawer navigation */
  mobile: 'xs' as const,

  /** Tablet: 600-899px - Drawer navigation, content */
  tablet: 'sm' as const,

  /** Desktop: 900px+ - Persistent sidebar, content, optional right sidebar */
  desktop: 'md' as const,
};

/**
 * Sidebar width constants (in pixels)
 */
export const SIDEBAR_WIDTHS = {
  /** Left persistent navigation sidebar (desktop) */
  left: 300,

  /** Right sidebar for page-specific content (future) */
  right: 280,

  /** Mobile/tablet drawer width */
  drawer: 280,
} as const;

/**
 * Header height constant (in pixels)
 */
export const HEADER_HEIGHT = 64;

/**
 * Content area max-width constraints
 */
export const CONTENT_MAX_WIDTH = {
  /** Optimal reading width in characters (~105 characters) */
  text: '70ch' as const,

  /** Maximum container width in pixels */
  container: 1200,
} as const;

/**
 * Z-index layering for layout components
 */
export const LAYOUT_Z_INDEX = {
  /** Mobile drawer */
  drawer: 1200,

  /** App header (above drawer) */
  header: 1201,
} as const;
