import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/features/api-client/websocket-client';

interface HistoryProviderProps {
  userId: string;
  children: React.ReactNode;
}

interface HistoryContextValue {
  isConnected: boolean;
  userId: string;
  socket: Socket | null;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export const HistoryProvider: React.FC<HistoryProviderProps> = ({ userId, children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Get or create the socket connection
    const socketInstance = getSocket('/mastra-chat-history', { userId });
    setSocket(socketInstance);

    const handleConnect = () => {
      console.log(`Mastra Chat History WebSocket connected - user: ${userId}`);
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Mastra Chat History WebSocket disconnected');
      setIsConnected(false);
    };

    const handleError = (error: Error) => {
      console.error('Mastra Chat History WebSocket error:', error);
      setIsConnected(false);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('connect_error', handleError);

    // Check if already connected
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    // Cleanup on unmount or when userId changes
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('connect_error', handleError);
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId]);

  const value: HistoryContextValue = {
    isConnected,
    userId,
    socket,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};

export const useHistoryContext = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistoryContext must be used within a HistoryProvider');
  }
  return context;
};
