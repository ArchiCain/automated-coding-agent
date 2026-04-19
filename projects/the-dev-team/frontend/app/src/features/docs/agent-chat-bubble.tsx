/**
 * Generic agent chat bubble — extracted from DocsChatBubble.
 * Handles WebSocket streaming, instructions editing, token tracking.
 * Parameterized by agentName, title, color, and callbacks.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
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

interface StepUsage {
  step: number;
  finishReason: string;
  toolCalls: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
  };
}

export interface AgentChatBubbleProps {
  agentName: string;
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  fabPosition: number; // offset from right in px
  activePath?: string | null;
  worktreePath?: string;
  disabled?: boolean;
  disabledTooltip?: string;
  hidden?: boolean; // hide FAB entirely (when another panel is open)
  onOpenChange?: (open: boolean) => void;
  onDocChanged?: () => void;
  onSyncComplete?: (data: {
    worktreePath: string;
    hasNewCommits: boolean;
    headBefore: string;
    headAfter: string;
  }) => void;
}

export function AgentChatBubble({
  agentName,
  title,
  icon,
  accentColor,
  fabPosition,
  activePath,
  worktreePath,
  disabled,
  disabledTooltip,
  hidden,
  onOpenChange,
  onDocChanged,
  onSyncComplete,
}: AgentChatBubbleProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onDocChangedRef = useRef(onDocChanged);
  onDocChangedRef.current = onDocChanged;
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  // Instructions state
  const [instructions, setInstructions] = useState<string>('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const hasConversation = messages.length > 0;

  // Token usage state
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens?: number;
  } | null>(null);
  const [stepHistory, setStepHistory] = useState<StepUsage[]>([]);
  const [usageExpanded, setUsageExpanded] = useState(false);

  // Socket connection
  useEffect(() => {
    const socket = io('/mastra', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

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
      if (data.toolName === 'writeFile' || data.toolName === 'editFile' || data.toolName === 'writeDoc') {
        onDocChangedRef.current?.();
      }
    });

    socket.on('agent:step', (data: StepUsage) => {
      setStepHistory((prev) => {
        const updated = [...prev, data];
        const u = data.usage;
        const lines: string[] = [];

        if (data.toolCalls?.length) {
          lines.push(`LLM call \u2192 ${data.toolCalls.join(', ')}`);
        } else {
          lines.push(`LLM call \u2192 response`);
        }
        lines.push(`  Prompt: ${u.inputTokens.toLocaleString()} tokens${u.cachedInputTokens ? ` (${u.cachedInputTokens.toLocaleString()} cached)` : ''}`);
        lines.push(`  Output: ${u.outputTokens.toLocaleString()} tokens`);

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
      setTokenUsage((prev) => ({
        inputTokens: (prev?.inputTokens ?? 0) + (data.usage.inputTokens ?? 0),
        outputTokens: (prev?.outputTokens ?? 0) + (data.usage.outputTokens ?? 0),
        totalTokens: (prev?.totalTokens ?? 0) + (data.usage.totalTokens ?? 0),
        cachedInputTokens: (prev?.cachedInputTokens ?? 0) + (data.usage.cachedInputTokens ?? 0),
      }));
    });

    socket.on('agent:sync-complete', (data: any) => {
      onSyncCompleteRef.current?.(data);
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

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = useCallback(
    (message: string) => {
      if (!socketRef.current) return;
      setIsStreaming(true);

      const contextPrefix = activePath ? `[Currently viewing: ${activePath}]\n\n` : '';
      const fullMessage = contextPrefix + message;

      const updatedMessages = [...messages, { type: 'user', content: message } as AgentMessage];
      setMessages(updatedMessages);

      const conversationMessages = updatedMessages
        .filter((m) => m.type === 'user' || m.type === 'assistant')
        .map((m, i, arr) => ({
          role: m.type!,
          content: i === arr.length - 1 && m.type === 'user' ? fullMessage : m.content || '',
        }));

      socketRef.current.emit('message', {
        agentName,
        messages: conversationMessages,
        systemPrompt: instructions,
        worktreePath,
      });
    },
    [messages, instructions, activePath, agentName, worktreePath],
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
    setInstructions(instructionsDraft);
    setEditingInstructions(false);
    setSavingInstructions(false);
  };

  // Floating bubble when closed
  if (!open) {
    if (hidden) return null;
    return (
      <Fab
        color="primary"
        onClick={() => { if (!disabled) { setOpen(true); onOpenChange?.(true); } }}
        title={disabled ? disabledTooltip : title}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: fabPosition,
          zIndex: 1300,
          bgcolor: disabled ? '#30363d' : accentColor,
          '&:hover': { bgcolor: disabled ? '#30363d' : accentColor },
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {icon}
      </Fab>
    );
  }

  // Chat panel
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
        <Box sx={{ fontSize: 18, color: accentColor, mr: 1, display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
        <Typography sx={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={() => { setOpen(false); onOpenChange?.(false); }} sx={{ color: 'text.secondary' }}>
          <MinimizeIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={() => { setOpen(false); onOpenChange?.(false); }} sx={{ color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Instructions block */}
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: `${accentColor}08`,
        }}
      >
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
          <Typography
            sx={{
              flex: 1,
              fontSize: '0.72rem',
              fontWeight: 600,
              color: accentColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            System Instructions
          </Typography>
          {!hasConversation && !editingInstructions && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                startEditingInstructions();
              }}
              sx={{ color: 'text.secondary', p: 0.25 }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>

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

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && !isStreaming ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.6 }}>
              {disabled
                ? disabledTooltip || 'This agent is currently disabled.'
                : `Start a conversation with ${title}.`}
            </Typography>
          </Box>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} systemPrompt={null} />
        )}
      </Box>

      {/* Token usage */}
      {tokenUsage && (
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: `${accentColor}08`,
          }}
        >
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
            {stepHistory.length > 0 &&
              (usageExpanded ? (
                <ExpandMoreIcon sx={{ fontSize: 12, color: 'text.secondary', mt: '1px' }} />
              ) : (
                <ChevronRightIcon sx={{ fontSize: 12, color: 'text.secondary', mt: '1px' }} />
              ))}
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              <Box component="span" sx={{ color: accentColor }}>
                In:
              </Box>{' '}
              {tokenUsage.inputTokens.toLocaleString()}
              {tokenUsage.cachedInputTokens
                ? ` (${tokenUsage.cachedInputTokens.toLocaleString()} cached)`
                : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              <Box component="span" sx={{ color: accentColor }}>
                Out:
              </Box>{' '}
              {tokenUsage.outputTokens.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', ml: 'auto' }}>
              <Box component="span" sx={{ color: accentColor }}>
                Total:
              </Box>{' '}
              {tokenUsage.totalTokens.toLocaleString()}
              {stepHistory.length > 0 && ` (${stepHistory.length} steps)`}
            </Typography>
          </Box>

          {usageExpanded && stepHistory.length > 0 && (
            <Box
              sx={{
                px: 1.5,
                pb: 0.75,
                maxHeight: 160,
                overflow: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: '#30363d transparent',
              }}
            >
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
                        <Typography
                          sx={{ fontSize: '0.6rem', color: '#d29922', fontFamily: 'monospace', ml: 'auto' }}
                        >
                          {s.toolCalls.length} call{s.toolCalls.length > 1 ? 's' : ''}: {s.toolCalls.join(', ')}
                        </Typography>
                      )}
                      {s.toolCalls.length === 0 && (
                        <Typography
                          sx={{ fontSize: '0.6rem', color: '#3fb950', fontFamily: 'monospace', ml: 'auto' }}
                        >
                          {s.finishReason}
                        </Typography>
                      )}
                    </Box>
                    {inputDelta > 0 && (
                      <Typography
                        sx={{ fontSize: '0.55rem', color: '#d29922', fontFamily: 'monospace', pl: '50px', ml: 1 }}
                      >
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
      <MessageInput onSend={sendMessage} onCancel={cancelMessage} isStreaming={isStreaming} disabled={!!disabled} />
    </Box>
  );
}
