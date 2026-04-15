import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { useChat } from './use-chat';
import { SessionSidebar } from './session-sidebar';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';

export function ChatPage() {
  const {
    sessions,
    activeSessionId,
    activeMessages,
    activeSystemPrompt,
    isStreaming,
    sessionsLoaded,
    createSession,
    deleteSession,
    sendMessage,
    cancelMessage,
    setActiveSessionId,
  } = useChat();

  // Auto-create a session if none exist after loading
  const autoCreated = useRef(false);
  useEffect(() => {
    if (sessionsLoaded && sessions.length === 0 && !autoCreated.current) {
      autoCreated.current = true;
      createSession();
    }
  }, [sessionsLoaded, sessions.length, createSession]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', pt: '48px' }}>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={setActiveSessionId}
          onCreate={createSession}
          onDelete={deleteSession}
        />

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            overflow: 'hidden',
          }}
        >
          <MessageList messages={activeMessages} systemPrompt={activeSystemPrompt} isStreaming={isStreaming} />
          <MessageInput
            isStreaming={isStreaming}
            onSend={sendMessage}
            onCancel={cancelMessage}
            disabled={!activeSessionId}
          />
        </Box>
      </Box>
    </Box>
  );
}
