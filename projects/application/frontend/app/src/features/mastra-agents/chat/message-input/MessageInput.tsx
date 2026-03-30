import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Box, IconButton, Paper, alpha, Tooltip, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useChatContext } from '../ChatProvider';
import { useMessageList } from '../message-list/MessageList';
import { messageInputService } from './message-input.service';

interface MessageInputProps {
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  disabled = false,
  placeholder = "Type your message...",
  className,
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { socket } = useChatContext();
  const { addUserMessage } = useMessageList();

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = Math.min(textarea.scrollHeight, 120); // Cap at 120px (about 5 lines)
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [message]);

  const handleSend = async () => {
    if (message.trim() && !disabled && !isSending && socket) {
      const messageContent = message.trim();
      setMessage('');
      setIsSending(true);

      try {
        // Add user message to UI
        addUserMessage(messageContent);
        // Send via WebSocket
        await messageInputService.sendMessage(socket, messageContent);
      } catch (error) {
        console.error('Error sending message:', error);
        // TODO: Show error to user
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', px: 2 }} className={className}>
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          maxWidth: 800,
          py: 1.5,
          px: 2,
          borderRadius: '12px',
          border: (theme) => `1px solid ${alpha(theme.palette.text.primary, 0.15)}`,
          background: (theme) => theme.palette.mode === 'dark'
            ? alpha('#2A2A2A', 0.6)
            : alpha('#ffffff', 0.9),
          backdropFilter: 'blur(12px)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            borderColor: (theme) => alpha(theme.palette.text.primary, 0.25),
            boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.text.primary, 0.08)}`,
          },
          '&:focus-within': {
            borderColor: (theme) => alpha(theme.palette.text.primary, 0.4),
            boxShadow: (theme) => `0 6px 24px ${alpha(theme.palette.text.primary, 0.12)}`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Box
          component="textarea"
          ref={textareaRef}
          value={message}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          sx={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '0.9375rem',
            fontWeight: 400,
            lineHeight: 1.6,
            minHeight: 24,
            maxHeight: 120,
            overflowY: 'auto',
            bgcolor: 'transparent',
            color: 'text.primary',
            fontFamily: 'inherit',
            '&::placeholder': {
              color: 'text.disabled',
              opacity: 0.7,
            },
            '&:disabled': {
              opacity: 0.5,
              cursor: 'not-allowed',
            },
            // Custom scrollbar
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: (theme) => alpha(theme.palette.text.secondary, 0.3),
              borderRadius: '3px',
              '&:hover': {
                background: (theme) => alpha(theme.palette.text.secondary, 0.5),
              },
            },
          }}
        />
        <Tooltip title={isSending ? "Sending..." : "Send message (Enter)"}>
          <span>
            <IconButton
              onClick={handleSend}
              disabled={isDisabled || !message.trim()}
              size="medium"
              color="primary"
              aria-label="Send message"
              sx={{
                bgcolor: (theme) => message.trim() && !isDisabled
                  ? alpha(theme.palette.text.primary, 0.08)
                  : 'transparent',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.15),
                  transform: 'scale(1.05)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
              }}
            >
              {isSending ? (
                <CircularProgress size={20} color="primary" />
              ) : (
                <SendIcon fontSize="medium" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Box>
  );
};
