import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import { AppHeader } from "@/features/app-header";
import { LeftNavigationSidebar, LeftNavigationDrawer } from "@/features/navigation";
import { useLayoutContext } from "./layout-context";
import type { AppLayoutProps } from "./types";

/**
 * AppLayout
 *
 * Main application layout with responsive 3-column structure:
 * - Mobile/Tablet: Header + Content + Drawer (temporary)
 * - Desktop: Header + Persistent Sidebar + Content + Drawer (temporary, overlays when open)
 * - Full-width pages (e.g., chat): Header + Content only
 */
export function AppLayout({ title = "Conversational AI" }: AppLayoutProps) {
  const { showPersistentLeftNav } = useLayoutContext();

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Persistent Left Navigation - Desktop only, unless full-width page */}
      {showPersistentLeftNav && <LeftNavigationSidebar />}

      {/* Main Content Column */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0, // Prevent flex item from exceeding bounds
        }}
      >
        {/* Header spans full width */}
        <AppHeader title={title} />

        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Temporary Drawer Navigation - Available on all viewports */}
      <LeftNavigationDrawer />
    </Box>
  );
}
