import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import TerminalIcon from '@mui/icons-material/Terminal';
import { useChat } from './use-chat';
import { SessionSidebar } from './session-sidebar';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';

export function ChatPage() {
  const {
    sessions,
    activeSessionId,
    activeMessages,
    isStreaming,
    createSession,
    deleteSession,
    sendMessage,
    cancelMessage,
    setActiveSessionId,
  } = useChat();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar variant="dense">
          <TerminalIcon sx={{ mr: 1, color: 'secondary.main' }} />
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}
          >
            THE Dev Team
          </Typography>
        </Toolbar>
      </AppBar>

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
          <MessageList messages={activeMessages} isStreaming={isStreaming} />
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
