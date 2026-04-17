import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import StopIcon from '@mui/icons-material/Stop';
import CircularProgress from '@mui/material/CircularProgress';
import { io, Socket } from 'socket.io-client';
import { MessageInput } from '../chat/message-input';
import type { AgentMessage, SessionHistory } from '../shared/types';

interface AgentDetailProps {
  sessionId: string;
  agentName: string;
  agentRole: string;
  ticketId: string;
  onClose: () => void;
  onStop: () => void;
}

export function AgentDetail({ sessionId, agentName, agentRole, ticketId, onClose, onStop }: AgentDetailProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('/agent', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.emit('join:session', { sessionId });

    socket.on('agent:history', (data: SessionHistory) => {
      setMessages(data.messages || []);
    });

    socket.on('agent:message', (msg: AgentMessage) => {
      setStreaming(true);
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('agent:done', () => {
      setStreaming(false);
    });

    socket.on('agent:error', (data: { error: string }) => {
      setStreaming(false);
      setMessages((prev) => [...prev, { type: 'error', content: data.error }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current) return;
    setStreaming(true);
    setMessages((prev) => [...prev, { type: 'user', sessionId, content: message }]);
    socketRef.current.emit('message', { sessionId, message });
  }, [sessionId]);

  const cancelMessage = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('cancel', { sessionId });
    setStreaming(false);
  }, [sessionId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {agentName} ({agentRole})
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {ticketId} {streaming && '— streaming...'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button
            size="small"
            color="error"
            startIcon={<StopIcon />}
            onClick={onStop}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            Stop
          </Button>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Message stream */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streaming && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Working...
            </Typography>
          </Box>
        )}
      </Box>

      {/* Chat input — talk directly to this agent */}
      <MessageInput
        onSend={sendMessage}
        onCancel={cancelMessage}
        isStreaming={streaming}
        disabled={false}
      />
    </Box>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  if (message.type === 'assistant' && message.content) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.primary',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '0.8rem',
          lineHeight: 1.5,
        }}
      >
        {message.content}
      </Typography>
    );
  }

  if (message.type === 'tool_use') {
    return (
      <Typography
        variant="caption"
        sx={{
          color: 'warning.main',
          fontFamily: 'monospace',
          fontSize: '0.7rem',
        }}
      >
        {message.tool}({typeof message.input === 'string' ? message.input.slice(0, 80) : JSON.stringify(message.input).slice(0, 80)})
      </Typography>
    );
  }

  if (message.type === 'tool_result') {
    return (
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          maxHeight: 60,
          overflow: 'hidden',
        }}
      >
        → {typeof message.content === 'string' ? message.content.slice(0, 120) : '(result)'}
      </Typography>
    );
  }

  if (message.type === 'error') {
    return (
      <Typography variant="caption" sx={{ color: 'error.main' }}>
        Error: {message.content}
      </Typography>
    );
  }

  return null;
}
