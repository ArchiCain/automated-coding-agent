import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
import type { User, UserSortField, SortDirection } from '../types';

interface Column {
  id: UserSortField | 'role' | 'status' | 'actions';
  label: string;
  sortable: boolean;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
}

const columns: Column[] = [
  { id: 'username', label: 'Username', sortable: true, minWidth: 120 },
  { id: 'email', label: 'Email', sortable: true, minWidth: 180 },
  { id: 'firstName', label: 'First Name', sortable: true, minWidth: 120 },
  { id: 'lastName', label: 'Last Name', sortable: true, minWidth: 120 },
  { id: 'role', label: 'Role', sortable: false, minWidth: 100 },
  { id: 'status', label: 'Status', sortable: false, align: 'center', minWidth: 100 },
  { id: 'actions', label: 'Actions', sortable: false, align: 'center', minWidth: 140 },
];

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  sortBy?: UserSortField;
  sortDirection?: SortDirection;
  onSort: (field: UserSortField) => void;
  onToggleEnabled: (user: User) => void;
  onDelete: (user: User) => void;
  className?: string;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  isLoading,
  sortBy,
  sortDirection = 'asc',
  onSort,
  onToggleEnabled,
  onDelete,
  className,
}) => {
  const handleSort = (field: Column['id']) => {
    if (field === 'role' || field === 'status' || field === 'actions') {
      return;
    }
    onSort(field);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
        }}
      >
        <CircularProgress size={32} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Loading users...
        </Typography>
      </Box>
    );
  }

  if (users.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No users found
        </Typography>
      </Box>
    );
  }

  const getPrimaryRole = (user: User): string => {
    if (user.roles.includes('admin')) {
      return 'Admin';
    }
    if (user.roles.includes('user')) {
      return 'User';
    }
    return user.roles[0] || 'Unknown';
  };

  return (
    <TableContainer component={Paper} className={className} sx={{ boxShadow: 1, overflowX: 'auto' }}>
      <Table sx={{ minWidth: 900, tableLayout: 'auto' }} aria-label="users table">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                sx={{
                  minWidth: column.minWidth,
                  fontWeight: 'bold',
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? theme.palette.background.default
                      : theme.palette.grey[50],
                }}
              >
                {column.sortable ? (
                  <TableSortLabel
                    active={sortBy === column.id}
                    direction={sortBy === column.id ? sortDirection : 'asc'}
                    onClick={() => handleSort(column.id)}
                  >
                    {column.label}
                  </TableSortLabel>
                ) : (
                  column.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <TableCell component="th" scope="row">
                <Typography variant="body2" fontWeight="medium">
                  {user.username}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{user.email}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{user.firstName || '-'}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{user.lastName || '-'}</Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={getPrimaryRole(user)}
                  size="small"
                  color={user.roles.includes('admin') ? 'primary' : 'default'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={user.enabled ? 'Enabled' : 'Disabled'}
                  size="small"
                  color={user.enabled ? 'success' : 'error'}
                  variant="filled"
                />
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                  <Tooltip title="Edit user">
                    <IconButton
                      component={RouterLink}
                      to={`/admin/users/${user.id}`}
                      size="small"
                      color="primary"
                      aria-label={`Edit ${user.username}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={user.enabled ? 'Disable user' : 'Enable user'}>
                    <IconButton
                      size="small"
                      color={user.enabled ? 'warning' : 'success'}
                      onClick={() => onToggleEnabled(user)}
                      aria-label={user.enabled ? `Disable ${user.username}` : `Enable ${user.username}`}
                    >
                      {user.enabled ? (
                        <PersonOffIcon fontSize="small" />
                      ) : (
                        <PersonIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete user">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(user)}
                      aria-label={`Delete ${user.username}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
