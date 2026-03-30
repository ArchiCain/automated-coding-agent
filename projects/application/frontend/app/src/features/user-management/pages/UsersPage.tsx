import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { UsersTable } from '../components/UsersTable';
import { DeleteUserModal } from '../components/DeleteUserModal';
import { userManagementApi } from '../services/user-management.api';
import type { User, UserListQuery, UserListResponse, UserSortField, SortDirection } from '../types';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const SEARCH_DEBOUNCE_MS = 300;

export default function UsersPage() {
  // Query state
  const [query, setQuery] = useState<UserListQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    search: '',
    sortBy: 'username',
    sortDirection: 'asc',
  });

  // Search input state (separate for debouncing)
  const [searchInput, setSearchInput] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data state
  const [data, setData] = useState<UserListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Toggle enabled loading state
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Fetch users when query changes
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await userManagementApi.getUsers(query);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search handler
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchInput(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      setQuery((prev) => ({
        ...prev,
        search: value,
        page: 1, // Reset to first page on search
      }));
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Sort handler
  const handleSort = useCallback((field: UserSortField) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: field,
      sortDirection: prev.sortBy === field && prev.sortDirection === 'asc' ? 'desc' : 'asc',
      page: 1, // Reset to first page on sort change
    }));
  }, []);

  // Page size handler
  const handlePageSizeChange = useCallback((event: { target: { value: unknown } }) => {
    const newPageSize = event.target.value as number;
    setQuery((prev) => ({
      ...prev,
      pageSize: newPageSize,
      page: 1, // Reset to first page on page size change
    }));
  }, []);

  // Pagination handlers
  const handlePreviousPage = useCallback(() => {
    setQuery((prev) => ({
      ...prev,
      page: Math.max(1, (prev.page || 1) - 1),
    }));
  }, []);

  const handleNextPage = useCallback(() => {
    if (!data?.pagination) return;
    setQuery((prev) => ({
      ...prev,
      page: Math.min(data.pagination.totalPages, (prev.page || 1) + 1),
    }));
  }, [data?.pagination]);

  // Toggle user enabled handler
  const handleToggleEnabled = useCallback(async (user: User) => {
    setTogglingUserId(user.id);

    try {
      const newEnabled = !user.enabled;
      await userManagementApi.toggleUserEnabled(user.id, newEnabled);
      // Refresh the list to show updated status
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle user status');
    } finally {
      setTogglingUserId(null);
    }
  }, [fetchUsers]);

  // Delete handlers
  const handleDeleteClick = useCallback((user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    // Refresh the list after successful deletion
    fetchUsers();
  }, [fetchUsers]);

  const currentPage = query.page || 1;
  const totalPages = data?.pagination?.totalPages || 1;
  const totalUsers = data?.pagination?.total || 0;
  const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;

  // Calculate displayed range
  const startIndex = totalUsers > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalUsers);

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
      <Box>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" fontWeight="bold">
            User Management
          </Typography>
          <Button
            component={RouterLink}
            to="/admin/users/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            Add User
          </Button>
        </Box>

        {/* Search */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search users by username, email, or name..."
            value={searchInput}
            onChange={handleSearchChange}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 400 }}
          />
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Users Table */}
        <UsersTable
          users={data?.users || []}
          isLoading={isLoading || togglingUserId !== null}
          sortBy={query.sortBy}
          sortDirection={query.sortDirection as SortDirection}
          onSort={handleSort}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDeleteClick}
        />

        {/* Pagination Controls */}
        {!isLoading && data && data.users.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 2,
              px: 1,
            }}
          >
            {/* Page Size Selector */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Rows per page:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  displayEmpty
                  inputProps={{ 'aria-label': 'Rows per page' }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Page Info */}
            <Typography variant="body2" color="text.secondary">
              {startIndex}–{endIndex} of {totalUsers}
            </Typography>

            {/* Prev/Next Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="Previous page">
                <span>
                  <IconButton
                    onClick={handlePreviousPage}
                    disabled={currentPage <= 1}
                    size="small"
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
                Page {currentPage} of {totalPages}
              </Typography>
              <Tooltip title="Next page">
                <span>
                  <IconButton
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                    size="small"
                    aria-label="Next page"
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Delete User Modal */}
        <DeleteUserModal
          isOpen={isDeleteModalOpen}
          onClose={handleDeleteModalClose}
          onSuccess={handleDeleteSuccess}
          user={userToDelete}
        />
      </Box>
    </Container>
  );
}
