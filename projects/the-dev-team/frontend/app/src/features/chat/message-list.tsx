import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CircularProgress from '@mui/material/CircularProgress';
import Markdown from 'react-markdown';
import type { AgentMessage } from '../shared';

interface MessageListProps {
  messages: AgentMessage[];
  systemPrompt: string | null;
  isStreaming: boolean;
}

function CollapsibleBlock({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ my: 0.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { opacity: 0.8 },
        }}
        onClick={() => setOpen(!open)}
      >
        <IconButton size="small" sx={{ color: 'text.secondary', p: 0, mr: 0.5 }}>
          {open ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            mt: 0.5,
            p: 1,
            bgcolor: '#0d1117',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'auto',
            maxHeight: 300,
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </Box>
      </Collapse>
    </Box>
  );
}

function formatContent(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const { type, content, tool, input, output } = message;

  if (type === 'user') {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: '#fff',
            px: 2,
            py: 1,
            borderRadius: 2,
            maxWidth: '75%',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <Typography variant="body2">{content}</Typography>
        </Box>
      </Box>
    );
  }

  if (type === 'assistant') {
    return (
      <Box sx={{ mb: 1.5, maxWidth: '85%' }}>
        <Box
          sx={{
            color: 'text.primary',
            '& p': { my: 0.5 },
            '& pre': {
              bgcolor: '#0d1117',
              p: 1,
              borderRadius: 1,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            },
            '& code': {
              fontSize: '0.8rem',
            },
          }}
        >
          <Markdown>{content ?? ''}</Markdown>
        </Box>
      </Box>
    );
  }

  if (type === 'tool_use') {
    return (
      <Box sx={{ mb: 1, pl: 1, borderLeft: '2px solid', borderColor: 'warning.main' }}>
        <Typography
          variant="caption"
          sx={{ color: 'warning.main', fontWeight: 600 }}
        >
          Tool: {tool}
        </Typography>
        {input !== undefined && (
          <CollapsibleBlock label="Input" content={formatContent(input)} />
        )}
      </Box>
    );
  }

  if (type === 'tool_result') {
    return (
      <Box sx={{ mb: 1, pl: 1, borderLeft: '2px solid', borderColor: 'secondary.main' }}>
        <Typography
          variant="caption"
          sx={{ color: 'secondary.main', fontWeight: 600 }}
        >
          Result
        </Typography>
        {output !== undefined && (
          <CollapsibleBlock label="Output" content={formatContent(output)} />
        )}
        {content && (
          <CollapsibleBlock label="Output" content={content} />
        )}
      </Box>
    );
  }

  if (type === 'error') {
    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          Error: {content}
        </Typography>
      </Box>
    );
  }

  if (type === 'system') {
    return (
      <Box sx={{ mb: 1, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {content}
        </Typography>
      </Box>
    );
  }

  // Fallback for unknown types
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        [{type}] {content ?? JSON.stringify(message)}
      </Typography>
    </Box>
  );
}

function SystemPromptBlock({ prompt }: { prompt: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <CollapsibleBlock label="System Instructions" content={prompt} />
    </Box>
  );
}

export function MessageList({ messages, systemPrompt, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!systemPrompt && messages.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body1">
          Start a conversation with the agent.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        p: 2,
        scrollbarWidth: 'thin',
        scrollbarColor: '#30363d #0d1117',
      }}
    >
      {systemPrompt && <SystemPromptBlock prompt={systemPrompt} />}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isStreaming && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <CircularProgress size={16} sx={{ color: 'primary.main' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Agent is working...
          </Typography>
        </Box>
      )}
      <div ref={bottomRef} />
    </Box>
  );
}
