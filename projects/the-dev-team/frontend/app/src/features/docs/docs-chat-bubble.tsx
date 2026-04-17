import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { io, Socket } from 'socket.io-client';
import { MessageList } from '../chat/message-list';
import { MessageInput } from '../chat/message-input';
import type { AgentMessage, Session, SessionHistory } from '../shared';

const DOCS_ROLE = 'default';
const DOCS_ROOT = 'benchmarking/build-a-frontend/docs';
const INSTRUCTIONS_FILE = '.agent-instructions.md';

const DEFAULT_INSTRUCTIONS = `You are a documentation assistant for this project. Your job is to help the user brainstorm, write, and refine project documentation.

You have access to read and write files in the project docs directory. The docs follow a structured format:
- pages/{name}/requirements.md — what each page does
- pages/{name}/components.md — component inventory
- pages/{name}/flows.md — step-by-step user flows (these are the acceptance tests)
- pages/{name}/test-data.md — test credentials, edge cases, API examples
- shared/{feature}/requirements.md — cross-cutting feature docs
- shared/{feature}/flows.md — feature lifecycle flows
- standards/ — coding and design standards

When helping the user:
- Ask clarifying questions before writing docs
- Follow the existing document structure and formatting
- Write flows as numbered step-by-step sequences
- Include concrete test data (usernames, passwords, expected responses)
- Keep requirements as checkbox acceptance criteria
`;

export function DocsChatBubble() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const initialized = useRef(false);

  // Instructions state
  const [instructions, setInstructions] = useState<string>(DEFAULT_INSTRUCTIONS);
  const [instructionsLoaded, setInstructionsLoaded] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const hasConversation = messages.length > 0;

  // Load instructions from file
  useEffect(() => {
    fetch(`/api/cluster/project-docs/read?root=${encodeURIComponent(DOCS_ROOT)}&path=${encodeURIComponent(INSTRUCTIONS_FILE)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setInstructions(data.content);
        }
        setInstructionsLoaded(true);
      })
      .catch(() => setInstructionsLoaded(true));
  }, []);

  // Set up socket connection
  useEffect(() => {
    const socket = io('/agent', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('agent:history', (data: SessionHistory) => {
      setMessages(data.messages);
    });

    socket.on('agent:message', (msg: AgentMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('agent:done', () => {
      setIsStreaming(false);
    });

    socket.on('agent:error', (data: { sessionId: string; error: string }) => {
      setMessages((prev) => [
        ...prev,
        { type: 'error', sessionId: data.sessionId, content: data.error },
      ]);
      setIsStreaming(false);
    });

    return () => { socket.disconnect(); };
  }, []);

  // Create session when chat is first opened
  const initSession = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const res = await fetch('/api/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: DOCS_ROLE }),
      });
      const session = (await res.json()) as Session;
      setSessionId(session.id);

      if (socketRef.current) {
        socketRef.current.emit('join:session', { sessionId: session.id });
      }
    } catch (err) {
      console.error('Failed to create docs chat session:', err);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (!initialized.current) {
      void initSession();
    }
  };

  const sendMessage = useCallback(
    (message: string) => {
      if (!sessionId || !socketRef.current) return;
      setIsStreaming(true);
      setMessages((prev) => [
        ...prev,
        { type: 'user', sessionId, content: message },
      ]);
      socketRef.current.emit('message', { sessionId, message });
    },
    [sessionId],
  );

  const cancelMessage = useCallback(() => {
    if (!sessionId || !socketRef.current) return;
    socketRef.current.emit('cancel', { sessionId });
    setIsStreaming(false);
  }, [sessionId]);

  const startEditingInstructions = () => {
    setInstructionsDraft(instructions);
    setEditingInstructions(true);
  };

  const saveInstructions = async () => {
    setSavingInstructions(true);
    try {
      const res = await fetch('/api/cluster/project-docs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: DOCS_ROOT, path: INSTRUCTIONS_FILE, content: instructionsDraft }),
      });
      if (res.ok) {
        setInstructions(instructionsDraft);
        setEditingInstructions(false);
      }
    } catch { /* ignore */ }
    finally { setSavingInstructions(false); }
  };

  // Floating bubble when closed
  if (!open) {
    return (
      <Fab
        color="primary"
        onClick={handleOpen}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
          bgcolor: '#58a6ff',
          '&:hover': { bgcolor: '#79b8ff' },
        }}
      >
        <ChatIcon />
      </Fab>
    );
  }

  // Chat panel when open
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 420,
        height: 600,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0d1117',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#161b22',
        }}
      >
        <ChatIcon sx={{ fontSize: 18, color: '#58a6ff', mr: 1 }} />
        <Typography sx={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
          Docs Assistant
        </Typography>
        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
          <MinimizeIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Instructions block */}
      {instructionsLoaded && (
        <Box
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(88, 166, 255, 0.04)',
          }}
        >
          {/* Instructions header */}
          <Box
            onClick={() => setInstructionsExpanded(!instructionsExpanded)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              py: 0.75,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
            }}
          >
            {instructionsExpanded ? (
              <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
            )}
            <Typography sx={{ flex: 1, fontSize: '0.72rem', fontWeight: 600, color: '#58a6ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Instructions
            </Typography>
            {!hasConversation && !editingInstructions && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); startEditingInstructions(); }}
                sx={{ color: 'text.secondary', p: 0.25 }}
              >
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>

          {/* Instructions content */}
          {instructionsExpanded && (
            <Box sx={{ px: 1.5, pb: 1 }}>
              {editingInstructions ? (
                <Box>
                  <TextField
                    multiline
                    fullWidth
                    minRows={6}
                    maxRows={12}
                    value={instructionsDraft}
                    onChange={(e) => setInstructionsDraft(e.target.value)}
                    sx={{
                      '& .MuiInputBase-root': {
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        lineHeight: 1.5,
                        bgcolor: '#161b22',
                        p: 1,
                      },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#30363d' },
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      onClick={() => setEditingInstructions(false)}
                      sx={{ fontSize: '0.7rem', textTransform: 'none', color: 'text.secondary', minWidth: 0, px: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon sx={{ fontSize: 12 }} />}
                      onClick={saveInstructions}
                      disabled={savingInstructions}
                      sx={{ fontSize: '0.7rem', textTransform: 'none', minWidth: 0, px: 1.5 }}
                    >
                      {savingInstructions ? 'Saving...' : 'Save'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    lineHeight: 1.6,
                    color: 'text.secondary',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    maxHeight: 160,
                    overflow: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#30363d transparent',
                  }}
                >
                  {instructions}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && !isStreaming ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.6 }}>
              Ask me to help with your project documentation. I can brainstorm features, write requirements, create flows, or update existing docs.
            </Typography>
          </Box>
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            systemPrompt={null}
          />
        )}
      </Box>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onCancel={cancelMessage}
        isStreaming={isStreaming}
        disabled={!sessionId}
      />
    </Box>
  );
}
