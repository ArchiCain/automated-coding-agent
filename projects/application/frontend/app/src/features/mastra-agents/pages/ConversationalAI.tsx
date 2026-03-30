import { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { MastraChatWithSidebar } from '@/features/mastra-agents';
import { useAuth } from '@/features/keycloak-auth';
import { MastraChatService } from '@/features/mastra-agents/chat/chat.service';

export default function ConversationalAI() {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string>('');

  // Generate or load thread ID
  useEffect(() => {
    // Check if there's a stored thread ID for this session
    const storedThreadId = sessionStorage.getItem('currentThreadId');
    if (storedThreadId) {
      setThreadId(storedThreadId);
    } else {
      // Generate new thread ID
      const newThreadId = MastraChatService.generateThreadId();
      sessionStorage.setItem('currentThreadId', newThreadId);
      setThreadId(newThreadId);
    }
  }, []);

  if (!user || !threadId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%' }}>
      <MastraChatWithSidebar
        userId={user.id}
        threadId={threadId}
        onThreadChange={(newThreadId) => {
          setThreadId(newThreadId);
          sessionStorage.setItem('currentThreadId', newThreadId);
        }}
      />
    </Box>
  );
}
