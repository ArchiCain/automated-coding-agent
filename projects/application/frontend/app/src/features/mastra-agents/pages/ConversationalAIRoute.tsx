import { useState, useEffect } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { ChatProvider } from '@/features/mastra-agents';
import { useAuth } from '@/features/keycloak-auth';
import { MastraChatService } from '@/features/mastra-agents/chat/chat.service';
import ConversationalAI from './ConversationalAI';

/**
 * Route wrapper that provides ChatContext for the entire app layout
 * This allows LeftNavigationDrawer to access chat state
 */
export default function ConversationalAIRoute() {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string>('');

  // Generate or load thread ID
  useEffect(() => {
    const storedThreadId = sessionStorage.getItem('currentThreadId');
    if (storedThreadId) {
      setThreadId(storedThreadId);
    } else {
      const newThreadId = MastraChatService.generateThreadId();
      sessionStorage.setItem('currentThreadId', newThreadId);
      setThreadId(newThreadId);
    }
  }, []);

  const handleThreadChange = (newThreadId: string) => {
    setThreadId(newThreadId);
    sessionStorage.setItem('currentThreadId', newThreadId);
  };

  if (!user || !threadId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ChatProvider
      value={{
        userId: user.id,
        threadId,
        onThreadChange: handleThreadChange,
      }}
    >
      <ConversationalAI />
    </ChatProvider>
  );
}
