import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import { io, Socket } from 'socket.io-client';
import { MessageList } from '../chat/message-list';
import { MessageInput } from '../chat/message-input';
import type { AgentMessage, SessionHistory, AgentRoleInfo } from '../shared/types';
import { ROLE_COLORS } from './types';

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<AgentRoleInfo[]>([]);
  const [selectedRole, setSelectedRole] = useState('team-lead');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load roles on mount
  useEffect(() => {
    fetch('/api/agent/roles')
      .then((res) => res.json())
      .then((data: AgentRoleInfo[]) => setRoles(data))
      .catch(() => {});
  }, []);

  // Connect socket once
  useEffect(() => {
    const socket = io('/agent', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('agent:history', (data: SessionHistory) => {
      setSystemPrompt(data.systemPrompt);
      setMessages(data.messages || []);
      setConnecting(false);
    });

    socket.on('agent:message', (msg: AgentMessage) => {
      setIsStreaming(true);
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('agent:done', () => {
      setIsStreaming(false);
    });

    socket.on('agent:error', (data: { error: string }) => {
      setIsStreaming(false);
      setMessages((prev) => [...prev, { type: 'error', content: data.error }]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Create a fresh session when bubble opens
  const openChat = useCallback(async () => {
    setOpen(true);
    setConnecting(true);
    setMessages([]);
    setSystemPrompt(null);

    try {
      const res = await fetch('/api/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      });
      const session = await res.json();
      setSessionId(session.id);
      socketRef.current?.emit('join:session', { sessionId: session.id });
    } catch {
      setConnecting(false);
    }
  }, [selectedRole]);

  // Close chat — session is disposable, memory handles continuity
  const closeChat = useCallback(() => {
    if (sessionId && isStreaming) {
      socketRef.current?.emit('cancel', { sessionId });
    }
    setOpen(false);
    setSessionId(null);
    setMessages([]);
    setSystemPrompt(null);
    setIsStreaming(false);
  }, [sessionId, isStreaming]);

  // Switch role — close current session, will create new one on next open
  const handleRoleChange = useCallback((newRole: string) => {
    setSelectedRole(newRole);
    if (open && sessionId) {
      // Close current and reopen with new role
      if (isStreaming) {
        socketRef.current?.emit('cancel', { sessionId });
      }
      setSessionId(null);
      setMessages([]);
      setSystemPrompt(null);
      setIsStreaming(false);
      setConnecting(true);

      // Create new session with new role
      fetch('/api/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
        .then((res) => res.json())
        .then((session) => {
          setSessionId(session.id);
          socketRef.current?.emit('join:session', { sessionId: session.id });
        })
        .catch(() => setConnecting(false));
    }
  }, [open, sessionId, isStreaming]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!sessionId || !socketRef.current) return;
      setIsStreaming(true);
      setMessages((prev) => [...prev, { type: 'user', sessionId, content: message }]);
      socketRef.current.emit('message', { sessionId, message });
    },
    [sessionId],
  );

  const cancelMessage = useCallback(() => {
    if (!sessionId || !socketRef.current) return;
    socketRef.current.emit('cancel', { sessionId });
    setIsStreaming(false);
  }, [sessionId]);

  const roleColor = ROLE_COLORS[selectedRole] || '#58a6ff';
  const roleDisplay = roles.find((r) => r.name === selectedRole)?.displayName || selectedRole;

  if (!open) {
    return (
      <Fab
        onClick={openChat}
        sx={{
          position: 'fixed',
          bottom: 56,
          right: 24,
          bgcolor: roleColor,
          color: '#fff',
          '&:hover': { bgcolor: roleColor, filter: 'brightness(1.2)' },
          zIndex: 1300,
        }}
      >
        <ChatIcon />
      </Fab>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 56,
        right: 24,
        width: 400,
        height: 560,
        bgcolor: '#0d1117',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1300,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#161b22',
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: connecting ? '#d29922' : '#3fb950',
            flexShrink: 0,
          }}
        />
        <Select
          size="small"
          value={selectedRole}
          onChange={(e) => handleRoleChange(e.target.value)}
          sx={{
            flex: 1,
            fontSize: '0.8rem',
            fontWeight: 600,
            '& .MuiSelect-select': { py: 0.5 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
          }}
        >
          {roles.map((r) => (
            <MenuItem key={r.name} value={r.name} sx={{ fontSize: '0.8rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: ROLE_COLORS[r.name] || '#8b949e',
                    flexShrink: 0,
                  }}
                />
                {r.displayName}
              </Box>
            </MenuItem>
          ))}
        </Select>
        <IconButton size="small" onClick={closeChat} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {connecting ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Connecting to {roleDisplay}...
            </Typography>
          </Box>
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            systemPrompt={systemPrompt}
          />
        )}
      </Box>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onCancel={cancelMessage}
        isStreaming={isStreaming}
        disabled={!sessionId || connecting}
      />
    </Box>
  );
}
