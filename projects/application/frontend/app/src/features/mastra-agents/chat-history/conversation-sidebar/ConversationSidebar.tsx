import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { ConversationList } from '../conversation-list/ConversationList';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

interface ConversationSidebarProps {
  activeThreadId: string;
  onSelectConversation: (threadId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (threadId: string) => void;
  className?: string;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  activeThreadId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  className,
}) => {
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Conversation List with New Message at top */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {/* New Message Button - styled like a conversation item */}
        <Box
          onClick={onNewConversation}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            position: 'relative',
            px: 0.75,
            py: 0.75,
            mb: 1,
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'all 0.15s ease-in-out',
            '&:hover': {
              bgcolor: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.03)',
            },
          }}
        >
          <Avatar
            sx={{
              width: 24,
              height: 24,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#404040' : '#6B6B6B',
              flexShrink: 0,
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: '0.875rem', color: 'white' }} />
          </Avatar>
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontSize: '0.875rem',
              fontWeight: 400,
              color: 'text.primary',
              lineHeight: 1.7,
            }}
          >
            New message
          </Typography>
        </Box>

        <ConversationList
          activeThreadId={activeThreadId}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </Box>
    </Box>
  );
};
