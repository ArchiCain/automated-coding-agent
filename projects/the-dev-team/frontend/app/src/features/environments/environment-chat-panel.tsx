import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useChat } from '../chat/use-chat';
import { MessageList } from '../chat/message-list';
import { MessageInput } from '../chat/message-input';

interface EnvironmentChatPanelProps {
  defaultRole?: string;
}

export function EnvironmentChatPanel({ defaultRole }: EnvironmentChatPanelProps) {
  const {
    sessions,
    activeSessionId,
    activeMessages,
    activeSystemPrompt,
    isStreaming,
    sessionsLoaded,
    roles,
    selectedRole,
    setSelectedRole,
    createSession,
    deleteSession,
    sendMessage,
    cancelMessage,
    setActiveSessionId,
  } = useChat();

  // Auto-select the default role
  useEffect(() => {
    if (defaultRole && roles.length > 0) {
      const exists = roles.find((r) => r.name === defaultRole);
      if (exists) setSelectedRole(defaultRole);
    }
  }, [defaultRole, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-create a session if none exist once loaded
  useEffect(() => {
    if (sessionsLoaded && sessions.length === 0) {
      void createSession();
    }
  }, [sessionsLoaded, sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      sx={{
        width: 350,
        minWidth: 350,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: '#0d1117',
        height: '100%',
      }}
    >
      {/* Header with role selector and session controls */}
      <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {roles.length > 0 && (
            <Select
              size="small"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              sx={{
                flex: 1,
                fontSize: '0.75rem',
                '& .MuiSelect-select': { py: 0.5 },
                bgcolor: '#161b22',
              }}
            >
              {roles.map((r) => (
                <MenuItem key={r.name} value={r.name} sx={{ fontSize: '0.75rem' }}>
                  {r.displayName}
                </MenuItem>
              ))}
            </Select>
          )}
          <IconButton size="small" onClick={() => void createSession()} sx={{ color: 'text.secondary' }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Compact session list */}
        {sessions.length > 1 && (
          <Box sx={{ mt: 0.5, maxHeight: 80, overflow: 'auto' }}>
            {sessions.map((s) => (
              <Box
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  bgcolor: s.id === activeSessionId ? 'rgba(88, 166, 255, 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    color: s.id === activeSessionId ? '#58a6ff' : 'text.secondary',
                  }}
                >
                  {s.id.slice(0, 8)}
                  {s.role && s.role !== 'default' && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ ml: 0.5, fontSize: '0.6rem', color: 'text.secondary' }}
                    >
                      {s.role}
                    </Typography>
                  )}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteSession(s.id);
                  }}
                  sx={{ p: 0.25, color: 'text.secondary', opacity: 0.5, '&:hover': { opacity: 1 } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <MessageList
          messages={activeMessages}
          isStreaming={isStreaming}
          systemPrompt={activeSystemPrompt}
        />
      </Box>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onCancel={cancelMessage}
        isStreaming={isStreaming}
        disabled={!activeSessionId}
      />
    </Box>
  );
}
