import React, { useState, useEffect } from 'react';
import { Card, CardContent, Box, Avatar, Typography, alpha } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { useChatContext } from '../ChatProvider';
import { Message, ResponseChunkEvent } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { messageListService } from './message-list.service';

interface ChatMessageProps {
  message: Message;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, className }) => {
  const { socket } = useChatContext();
  const isUser = message.role === 'user';

  // Local state for streaming content
  const [streamingContent, setStreamingContent] = useState(message.content);
  const [isStreaming, setIsStreaming] = useState(message.isStreaming ?? false);

  // Update isStreaming when message prop changes
  useEffect(() => {
    setIsStreaming(message.isStreaming ?? false);
  }, [message.isStreaming]);

  // Subscribe to streaming events if this message is streaming
  useEffect(() => {
    if (!isStreaming || !socket) return;

    const handleChunk = (event: ResponseChunkEvent) => {
      setStreamingContent(prev => prev + event.text);
    };

    messageListService.onResponseChunk(socket, handleChunk);

    return () => {
      messageListService.offResponseChunk(socket, handleChunk);
    };
  }, [isStreaming, socket]);

  // Use streamingContent if we were/are streaming, otherwise use message.content
  const displayContent = (message.isStreaming || streamingContent !== message.content) ? streamingContent : message.content;

  return (
    <Box
      role="article"
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
      className={className}
      sx={{
        display: 'flex',
        mb: 3,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        px: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          minWidth: 0,
          maxWidth: '85%',
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        {/* Avatar */}
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: (theme) => theme.palette.mode === 'dark'
              ? alpha('#404040', 0.4)
              : alpha('#6B6B6B', 0.2),
            color: 'text.primary',
            flexShrink: 0,
            border: (theme) => `2px solid ${alpha(theme.palette.text.primary, 0.15)}`,
          }}
        >
          {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
        </Avatar>

        {/* Message Content */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.5,
              ml: 0.5,
              color: 'text.secondary',
              fontWeight: 600,
              textAlign: isUser ? 'right' : 'left',
            }}
          >
            {isUser ? 'You' : 'AI Assistant'}
          </Typography>

          <Card
            elevation={0}
            sx={{
              bgcolor: isUser
                ? (theme) => alpha(theme.palette.text.primary, 0.05)
                : 'background.paper',
              border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: '14px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                borderColor: (theme) => alpha(theme.palette.text.primary, 0.2),
                boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.text.primary, 0.08)}`,
                transform: 'translateY(-1px)',
              },
            }}
          >
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ fontSize: '0.9375rem', wordBreak: 'break-word', lineHeight: 1.7 }}>
                {message.role === 'assistant' ? (
                  <>
                    {isStreaming && !displayContent ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 1 }}>
                        <Box
                          component="span"
                          sx={{
                            width: 8,
                            height: 8,
                            bgcolor: 'text.secondary',
                            borderRadius: '50%',
                            animation: 'bounce 1.2s ease-in-out infinite',
                            animationDelay: '0ms',
                            '@keyframes bounce': {
                              '0%, 80%, 100%': { transform: 'scale(0)' },
                              '40%': { transform: 'scale(1)' },
                            },
                          }}
                        />
                        <Box
                          component="span"
                          sx={{
                            width: 8,
                            height: 8,
                            bgcolor: 'text.secondary',
                            borderRadius: '50%',
                            animation: 'bounce 1.2s ease-in-out infinite',
                            animationDelay: '160ms',
                          }}
                        />
                        <Box
                          component="span"
                          sx={{
                            width: 8,
                            height: 8,
                            bgcolor: 'text.secondary',
                            borderRadius: '50%',
                            animation: 'bounce 1.2s ease-in-out infinite',
                            animationDelay: '320ms',
                          }}
                        />
                      </Box>
                    ) : (
                      <>
                        <MarkdownRenderer content={displayContent} />
                        {isStreaming && displayContent && (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              width: 2,
                              height: 18,
                              ml: 0.5,
                              bgcolor: 'text.primary',
                              animation: 'blink 1s step-start infinite',
                              borderRadius: '1px',
                              '@keyframes blink': {
                                '0%, 50%': { opacity: 1 },
                                '50.01%, 100%': { opacity: 0 },
                              },
                            }}
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <Box sx={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>
                    {message.content}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
