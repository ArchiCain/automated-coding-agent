import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';

interface MessageInputProps {
  isStreaming: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  disabled: boolean;
}

export function MessageInput({
  isStreaming,
  onSend,
  onCancel,
  disabled,
}: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Box
      sx={{
        p: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        gap: 1,
        alignItems: 'flex-end',
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Send a message to the agent..."
        disabled={isStreaming || disabled}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: '#0d1117',
            '& fieldset': { borderColor: 'divider' },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
          },
        }}
      />
      {isStreaming ? (
        <IconButton
          onClick={onCancel}
          sx={{
            color: 'error.main',
            bgcolor: 'rgba(248, 81, 73, 0.1)',
            '&:hover': { bgcolor: 'rgba(248, 81, 73, 0.2)' },
          }}
        >
          <StopIcon />
        </IconButton>
      ) : (
        <IconButton
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          sx={{
            color: 'primary.main',
            '&.Mui-disabled': { color: 'text.secondary' },
          }}
        >
          <SendIcon />
        </IconButton>
      )}
    </Box>
  );
}
