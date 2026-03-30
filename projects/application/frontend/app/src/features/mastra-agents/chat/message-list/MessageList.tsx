import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useChatContext } from '../ChatProvider';
import { ChatMessage } from './ChatMessage';
import { messageListService } from './message-list.service';
import { Message, ConversationHistoryEvent, ResponseChunkEvent } from '../types';

interface MessageListContextValue {
  addUserMessage: (content: string) => void;
  messages: Message[];
}

const MessageListContext = createContext<MessageListContextValue | null>(null);

export const useMessageList = () => {
  const context = useContext(MessageListContext);
  if (!context) {
    throw new Error('useMessageList must be used within MessageList');
  }
  return context;
};

interface MessageListProps {
  className?: string;
  children?: React.ReactNode;
}

export const MessageList: React.FC<MessageListProps> = ({ className, children }) => {
  const { socket } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Listen for streaming chunks to scroll during streaming
  useEffect(() => {
    if (!socket) return;

    const handleChunk = (event: ResponseChunkEvent) => {
      // Update the last message (which should be the streaming assistant message)
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + event.text,
            },
          ];
        }
        return prev;
      });

      // Scroll during streaming to follow the content
      scrollToBottom();
    };

    messageListService.onResponseChunk(socket, handleChunk);

    return () => {
      messageListService.offResponseChunk(socket, handleChunk);
    };
  }, [socket, scrollToBottom]);

  // Listen for streaming complete to mark message as finished
  useEffect(() => {
    if (!socket) return;

    const handleComplete = () => {
      // Mark the last streaming message as complete
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              isStreaming: false,
            },
          ];
        }
        return prev;
      });
    };

    socket.on('response-complete', handleComplete);

    return () => {
      socket.off('response-complete', handleComplete);
    };
  }, [socket]);

  // Subscribe to conversation history on mount
  useEffect(() => {
    if (!socket) return;

    const handleConversationHistory = (event: ConversationHistoryEvent) => {
      // Ensure all loaded messages are marked as not streaming (they're historical)
      const historicalMessages = event.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp), // Ensure timestamp is Date object
        isStreaming: false,
      }));
      setMessages(historicalMessages);
      setIsLoading(false);
    };

    const handleError = (event: { error: string; details?: string }) => {
      console.error('Chat error:', event);
      // Add error message to chat
      const errorMessage = messageListService.createAssistantMessage(
        event.error + (event.details ? `: ${event.details}` : ''),
        false
      );
      setMessages(prev => [...prev.map(msg => ({ ...msg, isStreaming: false })), errorMessage]);
    };

    messageListService.onConversationHistory(socket, handleConversationHistory);
    messageListService.onChatError(socket, handleError);

    return () => {
      messageListService.offConversationHistory(socket, handleConversationHistory);
      messageListService.offChatError(socket, handleError);
    };
  }, [socket]);

  // Function to add user message and create streaming assistant message
  const addUserMessage = useCallback((content: string) => {
    const userMessage = messageListService.createUserMessage(content);

    // Add empty assistant message for streaming
    const assistantMessage = messageListService.createAssistantMessage('', true);

    // Update messages: mark all previous messages as not streaming, then add new ones
    setMessages(prev => [
      ...prev.map(msg => ({ ...msg, isStreaming: false })),
      userMessage,
      assistantMessage,
    ]);
  }, []);

  const contextValue: MessageListContextValue = {
    addUserMessage,
    messages,
  };

  return (
    <MessageListContext.Provider value={contextValue}>
      {isLoading ? (
        <Box
          className={className}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Loading conversation...
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          className={className}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1.5,
            minHeight: 0,
          }}
        >
          <Box sx={{ maxWidth: '768px', mx: 'auto' }}>
            {messages.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Welcome
                  </Typography>
                  <Typography variant="body2">
                    Start a conversation by sending a message below.
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>
        </Box>
      )}
      {children}
    </MessageListContext.Provider>
  );
};
