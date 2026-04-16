import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Session, AgentRoleInfo } from '../shared';

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  roles: AgentRoleInfo[];
  selectedRole: string;
  onRoleChange: (role: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  roles,
  selectedRole,
  onRoleChange,
  onSelect,
  onCreate,
  onDelete,
}: SessionSidebarProps) {
  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {roles.length > 0 && (
        <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
            Agent Role
          </Typography>
          <Select
            value={selectedRole}
            onChange={e => onRoleChange(e.target.value)}
            size="small"
            fullWidth
            sx={{
              bgcolor: 'rgba(255,255,255,0.05)',
              '.MuiSelect-select': { py: 0.75, fontSize: '0.85rem' },
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
            }}
          >
            {roles.map(role => (
              <MenuItem key={role.name} value={role.name}>
                {role.displayName}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}

      <Box sx={{ p: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onCreate}
          sx={{
            borderColor: 'divider',
            color: 'text.primary',
            textTransform: 'none',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'rgba(88, 166, 255, 0.08)',
            },
          }}
        >
          New Chat
        </Button>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto', px: 0.5 }}>
        {sessions.map((session) => (
          <ListItemButton
            key={session.id}
            selected={session.id === activeSessionId}
            onClick={() => onSelect(session.id)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              py: 0.75,
              px: 1.5,
              '&.Mui-selected': {
                bgcolor: 'rgba(88, 166, 255, 0.12)',
                '&:hover': { bgcolor: 'rgba(88, 166, 255, 0.18)' },
              },
            }}
          >
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontSize: '0.8rem' }}
                >
                  Session {session.id.slice(0, 8)}
                </Typography>
              }
              secondary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                  >
                    {formatTime(session.createdAt)}
                  </Typography>
                  {session.role && session.role !== 'default' && (
                    <Chip
                      label={session.role}
                      size="small"
                      sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                    />
                  )}
                </Box>
              }
            />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              sx={{
                color: 'text.secondary',
                opacity: 0.5,
                '&:hover': { opacity: 1, color: 'error.main' },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
      </List>

      {sessions.length === 0 && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            No sessions yet. Click "New Chat" to start.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
