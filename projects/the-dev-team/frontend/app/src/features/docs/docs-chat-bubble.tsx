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
import type { AgentMessage } from '../shared';

const DOCS_ROOT = 'projects/application/frontend/docs';
const INSTRUCTIONS_FILE = '.agent-instructions.md';

const DEFAULT_INSTRUCTIONS = '';

interface DocsChatBubbleProps {
  activePath?: string | null;
  onDocChanged?: () => void;
}

export function DocsChatBubble({ activePath, onDocChanged }: DocsChatBubbleProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onDocChangedRef = useRef(onDocChanged);
  onDocChangedRef.current = onDocChanged;

  // Instructions state
  const [instructions, setInstructions] = useState<string>(DEFAULT_INSTRUCTIONS);
  const [instructionsLoaded, setInstructionsLoaded] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const hasConversation = messages.length > 0;

  // Token usage state
  interface StepUsage {
    step: number;
    finishReason: string;
    toolCalls: string[];
    usage: { inputTokens: number; outputTokens: number; totalTokens: number; cachedInputTokens: number };
  }
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens?: number;
  } | null>(null);
  const [stepHistory, setStepHistory] = useState<StepUsage[]>([]);
  const [usageExpanded, setUsageExpanded] = useState(false);

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

  // Set up socket connection — Mastra namespace
  useEffect(() => {
    const socket = io('/mastra', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // Text deltas arrive as raw strings — accumulate into one assistant bubble
    socket.on('agent:delta', (text: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === 'assistant' && last._streaming) {
          const updated = { ...last, content: (last.content || '') + text };
          return [...prev.slice(0, -1), updated];
        }
        return [...prev, { type: 'assistant', content: text, _streaming: true }];
      });
    });

    socket.on('agent:tool-call', (data: { toolName: string; args: Record<string, unknown> }) => {
      setMessages((prev) => [
        ...prev,
        { type: 'tool_use', tool: data.toolName, input: data.args },
      ]);
    });

    socket.on('agent:tool-result', (data: { toolName: string; result: unknown }) => {
      setMessages((prev) => [
        ...prev,
        { type: 'tool_result', tool: data.toolName, output: data.result },
      ]);
      if (data.toolName === 'writeDoc') {
        onDocChangedRef.current?.();
      }
    });

    socket.on('agent:step', (data: any) => {
      console.log(`[Mastra] Step ${data.step}:`, data.usage, 'tools:', data.toolCalls, 'finish:', data.finishReason);
      setStepHistory((prev) => {
        const updated = [...prev, data];
        // Build a detailed label showing what happened and what it cost
        const u = data.usage;
        const lines: string[] = [];

        if (data.toolCalls?.length) {
          lines.push(`LLM call → ${data.toolCalls.join(', ')}`);
        } else {
          lines.push(`LLM call → response`);
        }
        lines.push(`  Prompt: ${u.inputTokens.toLocaleString()} tokens${u.cachedInputTokens ? ` (${u.cachedInputTokens.toLocaleString()} cached)` : ''}`);
        lines.push(`  Output: ${u.outputTokens.toLocaleString()} tokens`);

        // Show the delta — what the tool result added to the context
        if (data.step > 0) {
          const prevStep = updated[data.step - 1];
          if (prevStep) {
            const delta = u.inputTokens - prevStep.usage.inputTokens;
            lines.push(`  +${delta.toLocaleString()} from tool result`);
          }
        }

        setMessages((prev) => [...prev, { type: 'system', content: lines.join('\n') }]);
        return updated;
      });
    });

    socket.on('agent:usage', (data: { usage: Record<string, number>; finishReason?: string }) => {
      console.log('[Mastra] Aggregated usage:', data.usage, 'finishReason:', data.finishReason);
      setTokenUsage((prev) => ({
        inputTokens: (prev?.inputTokens ?? 0) + (data.usage.inputTokens ?? 0),
        outputTokens: (prev?.outputTokens ?? 0) + (data.usage.outputTokens ?? 0),
        totalTokens: (prev?.totalTokens ?? 0) + (data.usage.totalTokens ?? 0),
        cachedInputTokens: (prev?.cachedInputTokens ?? 0) + (data.usage.cachedInputTokens ?? 0),
      }));
    });

    socket.on('agent:done', () => {
      setMessages((prev) =>
        prev.map((m) => (m._streaming ? { ...m, _streaming: undefined } : m)),
      );
      setIsStreaming(false);
    });

    socket.on('agent:error', (error: string) => {
      setMessages((prev) => [...prev, { type: 'error', content: error }]);
      setIsStreaming(false);
    });

    return () => { socket.disconnect(); };
  }, []);

  const sendMessage = useCallback(
    (message: string) => {
      if (!socketRef.current) return;
      setIsStreaming(true);

      // Prepend active document context if the user has a file open
      const contextPrefix = activePath ? `[Currently viewing: ${activePath}]\n\n` : '';
      const fullMessage = contextPrefix + message;

      // Add user message to local state (show original message, not the prefixed one)
      const updatedMessages = [...messages, { type: 'user', content: message } as AgentMessage];
      setMessages(updatedMessages);

      // Build the messages array for the backend — only user/assistant
      // Use the context-prefixed message for the latest user message
      const conversationMessages = updatedMessages
        .filter((m) => m.type === 'user' || m.type === 'assistant')
        .map((m, i, arr) => ({
          role: m.type!,
          content: i === arr.length - 1 && m.type === 'user' ? fullMessage : m.content || '',
        }));

      socketRef.current.emit('message', {
        messages: conversationMessages,
        systemPrompt: instructions,
      });
    },
    [messages, instructions, activePath],
  );

  const cancelMessage = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('cancel');
    setIsStreaming(false);
  }, []);

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
        onClick={() => setOpen(true)}
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
                  {instructions || '(No system instructions set)'}
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

      {/* Token usage */}
      {tokenUsage && (
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(88, 166, 255, 0.04)',
          }}
        >
          {/* Summary row — clickable to expand */}
          <Box
            onClick={() => stepHistory.length > 0 && setUsageExpanded(!usageExpanded)}
            sx={{
              display: 'flex',
              gap: 1.5,
              px: 1.5,
              py: 0.5,
              cursor: stepHistory.length > 0 ? 'pointer' : 'default',
              '&:hover': stepHistory.length > 0 ? { bgcolor: 'rgba(255,255,255,0.03)' } : {},
            }}
          >
            {stepHistory.length > 0 && (
              usageExpanded
                ? <ExpandMoreIcon sx={{ fontSize: 12, color: 'text.secondary', mt: '1px' }} />
                : <ChevronRightIcon sx={{ fontSize: 12, color: 'text.secondary', mt: '1px' }} />
            )}
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              <Box component="span" sx={{ color: '#58a6ff' }}>In:</Box> {tokenUsage.inputTokens.toLocaleString()}
              {tokenUsage.cachedInputTokens ? ` (${tokenUsage.cachedInputTokens.toLocaleString()} cached)` : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              <Box component="span" sx={{ color: '#58a6ff' }}>Out:</Box> {tokenUsage.outputTokens.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', ml: 'auto' }}>
              <Box component="span" sx={{ color: '#58a6ff' }}>Total:</Box> {tokenUsage.totalTokens.toLocaleString()}
              {stepHistory.length > 0 && ` (${stepHistory.length} steps)`}
            </Typography>
          </Box>

          {/* Per-step breakdown */}
          {usageExpanded && stepHistory.length > 0 && (
            <Box sx={{ px: 1.5, pb: 0.75, maxHeight: 160, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#30363d transparent' }}>
              {stepHistory.map((s, i) => {
                const prevStep = i > 0 ? stepHistory[i - 1] : null;
                const inputDelta = prevStep ? s.usage.inputTokens - prevStep.usage.inputTokens : 0;
                return (
                  <Box key={i} sx={{ py: 0.25, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.6rem', color: '#8b949e', fontFamily: 'monospace', minWidth: 50 }}>
                        Step {s.step}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: '#8b949e', fontFamily: 'monospace' }}>
                        in:{s.usage.inputTokens.toLocaleString()}
                        {s.usage.cachedInputTokens ? ` (${s.usage.cachedInputTokens.toLocaleString()}c)` : ''}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: '#8b949e', fontFamily: 'monospace' }}>
                        out:{s.usage.outputTokens.toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: '#8b949e', fontFamily: 'monospace' }}>
                        = {s.usage.totalTokens.toLocaleString()}
                      </Typography>
                      {s.toolCalls.length > 0 && (
                        <Typography sx={{ fontSize: '0.6rem', color: '#d29922', fontFamily: 'monospace', ml: 'auto' }}>
                          {s.toolCalls.length} call{s.toolCalls.length > 1 ? 's' : ''}: {s.toolCalls.join(', ')}
                        </Typography>
                      )}
                      {s.toolCalls.length === 0 && (
                        <Typography sx={{ fontSize: '0.6rem', color: '#3fb950', fontFamily: 'monospace', ml: 'auto' }}>
                          {s.finishReason}
                        </Typography>
                      )}
                    </Box>
                    {inputDelta > 0 && (
                      <Typography sx={{ fontSize: '0.55rem', color: '#d29922', fontFamily: 'monospace', pl: '50px', ml: 1 }}>
                        +{inputDelta.toLocaleString()} tokens from tool result
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onCancel={cancelMessage}
        isStreaming={isStreaming}
        disabled={false}
      />
    </Box>
  );
}
