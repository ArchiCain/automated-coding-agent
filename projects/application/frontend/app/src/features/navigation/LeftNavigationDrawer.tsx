import { Drawer, Box, Typography, IconButton, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { NavigationTree } from './NavigationTree';
import { navigationConfig } from '@/features/navigation-config';
import { useLayoutContext } from '@/features/layouts';
import { SIDEBAR_WIDTHS } from '@/features/layouts';

/**
 * LeftNavigationDrawer
 *
 * Temporary drawer for mobile and tablet viewports.
 * Opens from the left and overlays the content.
 */
export function LeftNavigationDrawer() {
  const { isLeftDrawerOpen, closeLeftDrawer } = useLayoutContext();

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={isLeftDrawerOpen}
      onClose={closeLeftDrawer}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      sx={{
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTHS.drawer,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight="bold" color="primary">
            Navigation
          </Typography>
          <IconButton onClick={closeLeftDrawer} size="small" aria-label="Close navigation">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Navigation Tree */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <NavigationTree items={navigationConfig.items} />
        </Box>
      </Box>
    </Drawer>
  );
}
