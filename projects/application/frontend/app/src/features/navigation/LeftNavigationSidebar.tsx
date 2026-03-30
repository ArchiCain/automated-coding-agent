import { Drawer, Box } from '@mui/material';
import { NavigationTree } from './NavigationTree';
import { navigationConfig } from '@/features/navigation-config';
import { SIDEBAR_WIDTHS, HEADER_HEIGHT } from '@/features/layouts';

/**
 * LeftNavigationSidebar
 *
 * Persistent navigation sidebar for desktop viewports.
 * Displays below the header and contains the hierarchical navigation tree.
 */
export function LeftNavigationSidebar() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTHS.left,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTHS.left,
          boxSizing: 'border-box',
          top: HEADER_HEIGHT,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box
        sx={{
          overflow: 'auto',
          p: 2,
          height: '100%',
        }}
      >
        <NavigationTree items={navigationConfig.items} />
      </Box>
    </Drawer>
  );
}
