import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/features/api-client/websocket-client';

interface ChatProviderProps {
  userId: string;
  threadId: string;
  children: React.ReactNode;
}

interface ChatContextValue {
  isConnected: boolean;
  userId: string;
  threadId: string;
  socket: Socket | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<ChatProviderProps> = ({ userId, threadId, children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!userId || !threadId) return;

    // Get or create the socket connection
    const socketInstance = getSocket('/mastra-chat', { userId, threadId });
    setSocket(socketInstance);

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (error: Error) => {
      console.error('Mastra Chat WebSocket error:', error);
      setIsConnected(false);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('connect_error', handleError);

    // Check if already connected
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    // Cleanup on unmount or when userId/threadId changes
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('connect_error', handleError);
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId, threadId]);

  const value: ChatContextValue = {
    isConnected,
    userId,
    threadId,
    socket,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
