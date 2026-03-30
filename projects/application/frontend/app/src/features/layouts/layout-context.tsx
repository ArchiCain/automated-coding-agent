import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme, useMediaQuery } from '@mui/material';
import { navigationConfig, findNavItemByPath } from '@/features/navigation-config';

/**
 * Layout context value
 */
interface LayoutContextValue {
  // Responsive breakpoint flags
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // Drawer state
  isLeftDrawerOpen: boolean;
  toggleLeftDrawer: () => void;
  closeLeftDrawer: () => void;

  // Layout configuration
  isFullWidthPage: boolean;
  showPersistentLeftNav: boolean;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

/**
 * Layout Provider
 *
 * Manages responsive layout state and navigation drawer behavior.
 * Uses MUI's useMediaQuery to detect breakpoints and adjust layout accordingly.
 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const location = useLocation();

  // Responsive breakpoint detection
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Drawer state (for mobile/tablet)
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);

  // Detect if current page should be full-width (e.g., chat page)
  const currentNavItem = findNavItemByPath(navigationConfig.items, location.pathname);
  const isFullWidthPage = currentNavItem?.metadata?.fullWidth ?? false;

  // Persistent left nav is disabled - navigation is only via hamburger menu
  const showPersistentLeftNav = false;

  // Auto-close drawer when switching to desktop (persistent sidebar takes over)
  useEffect(() => {
    if (isDesktop) {
      setIsLeftDrawerOpen(false);
    }
  }, [isDesktop]);

  // Close drawer on route change (all viewports)
  useEffect(() => {
    setIsLeftDrawerOpen(false);
  }, [location.pathname]);

  const toggleLeftDrawer = () => {
    setIsLeftDrawerOpen(prev => !prev);
  };

  const closeLeftDrawer = () => {
    setIsLeftDrawerOpen(false);
  };

  const value: LayoutContextValue = {
    isMobile,
    isTablet,
    isDesktop,
    isLeftDrawerOpen,
    toggleLeftDrawer,
    closeLeftDrawer,
    isFullWidthPage,
    showPersistentLeftNav,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

/**
 * Hook to access layout context
 *
 * @throws Error if used outside LayoutProvider
 */
export function useLayoutContext(): LayoutContextValue {
  const context = useContext(LayoutContext);

  if (context === undefined) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }

  return context;
}
