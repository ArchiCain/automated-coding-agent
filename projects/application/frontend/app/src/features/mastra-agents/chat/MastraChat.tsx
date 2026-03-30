import React from 'react';
import { Box } from '@mui/material';
import { ChatProvider } from './ChatProvider';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';

interface MastraChatProps {
  userId: string;
  threadId: string;
  className?: string;
}

export const MastraChat: React.FC<MastraChatProps> = ({
  userId,
  threadId,
  className,
}) => {
  return (
    <ChatProvider userId={userId} threadId={threadId}>
      <Box
        className={className}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'background.paper',
        }}
      >
        <MessageList>
          {/* Input Area */}
          <Box
            sx={{
              flexShrink: 0,
              px: 2,
              py: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <MessageInput placeholder="Type your message..." />
          </Box>
        </MessageList>
      </Box>
    </ChatProvider>
  );
};
