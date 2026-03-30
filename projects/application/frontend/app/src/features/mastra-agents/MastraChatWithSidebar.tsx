import React, { useState } from 'react';
import { Box, Drawer, IconButton, useTheme, useMediaQuery } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { MastraChat } from '@/features/mastra-agents/chat';
import { MastraChatHistory } from '@/features/mastra-agents/chat-history';
import { MastraChatService } from '@/features/mastra-agents/chat';
import { useLayoutContext } from '@/features/layouts';

interface MastraChatWithSidebarProps {
  userId: string;
  threadId: string;
  onThreadChange: (threadId: string) => void;
  className?: string;
}

const SIDEBAR_WIDTH = 240;

export const MastraChatWithSidebar: React.FC<MastraChatWithSidebarProps> = ({
  userId,
  threadId,
  onThreadChange,
  className,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { isLeftDrawerOpen } = useLayoutContext();

  // Hide arrow toggle when nav drawer is open on mobile (to avoid overlap)
  const showArrowToggle = !(isMobile && isLeftDrawerOpen);

  const handleNewConversation = () => {
    const newThreadId = MastraChatService.generateThreadId();
    onThreadChange(newThreadId);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectConversation = (selectedThreadId: string) => {
    if (selectedThreadId === threadId) return;
    onThreadChange(selectedThreadId);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const sidebarContent = (
    <MastraChatHistory
      userId={userId}
      activeThreadId={threadId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
    />
  );

  return (
    <Box className={className} sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Desktop Sidebar - collapsible */}
      {!isMobile && isSidebarOpen && (
        <Box
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'dark' ? '#1A1A1A' : '#F7F7F7',
          }}
        >
          {sidebarContent}
        </Box>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              bgcolor: theme.palette.mode === 'dark' ? '#1A1A1A' : '#F7F7F7',
              top: '64px', // Below header
              height: 'calc(100% - 64px)',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
        {/* Toggle Button - hidden when nav drawer is open on mobile */}
        {showArrowToggle && (
          <IconButton
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          sx={{
            position: 'absolute',
            // On mobile, slide the button with the drawer when open
            left: isMobile && isSidebarOpen ? SIDEBAR_WIDTH + 8 : 8,
            top: 8,
            // Use drawer zIndex + 1 to ensure visibility above mobile drawer (zIndex 1200)
            zIndex: isMobile ? theme.zIndex.drawer + 1 : 1,
            bgcolor: theme.palette.mode === 'dark' ? '#333333' : '#FFFFFF',
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              bgcolor: theme.palette.mode === 'dark' ? '#444444' : '#F5F5F5',
            },
            // Smooth transition when drawer opens/closes
            transition: theme.transitions.create('left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          }}
          aria-label={isSidebarOpen ? 'Close conversation list' : 'Open conversation list'}
        >
          {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
        )}

        <MastraChat
          userId={userId}
          threadId={threadId}
        />
      </Box>
    </Box>
  );
};
