import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  IconButton,
  Alert,
  Skeleton,
  Snackbar,
  Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { UserForm, UserFormValues, UserFormMode } from '../components/UserForm';
import { userManagementApi } from '../services/user-management.api';
import type { User, CreateUserRequest, UpdateUserRequest } from '../types';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const mode: UserFormMode = isEditMode ? 'edit' : 'create';

  // State for user data in edit mode
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);

  // State for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // State for success toast
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch user data in edit mode
  useEffect(() => {
    if (!isEditMode || !id) {
      setIsLoadingUser(false);
      return;
    }

    const fetchUser = async () => {
      setIsLoadingUser(true);
      setLoadError(null);

      try {
        const userData = await userManagementApi.getUserById(id);
        setUser(userData);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUser();
  }, [id, isEditMode]);

  // Convert User to UserFormValues
  const getInitialValues = useCallback((): Partial<UserFormValues> | undefined => {
    if (!user) return undefined;

    return {
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      // Get the first role, default to 'user'
      role: user.roles?.[0] || 'user',
    };
  }, [user]);

  // Handle form submission
  const handleSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEditMode && id) {
        // Update existing user (email is immutable since it's the username)
        const updateData: UpdateUserRequest = {
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
        };

        await userManagementApi.updateUser(id, updateData);
        setSuccessMessage('User updated successfully');
      } else {
        // Create new user
        const createData: CreateUserRequest = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          temporaryPassword: values.temporaryPassword || '',
          role: values.role,
        };

        await userManagementApi.createUser(createData);
        setSuccessMessage('User created successfully');
      }

      setShowSuccessToast(true);

      // Navigate to users list after a brief delay to show toast
      setTimeout(() => {
        navigate('/admin/users');
      }, 500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save user');
      setIsSubmitting(false);
    }
  };

  // Close success toast handler
  const handleCloseToast = () => {
    setShowSuccessToast(false);
  };

  // Render loading skeleton for edit mode
  const renderLoadingSkeleton = () => (
    <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
      <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={48} width={160} sx={{ mt: 3 }} />
    </Paper>
  );

  // Render error state
  const renderError = () => (
    <Alert
      severity="error"
      sx={{ mb: 3 }}
      action={
        <IconButton
          aria-label="go back"
          color="inherit"
          size="small"
          component={RouterLink}
          to="/admin/users"
        >
          <ArrowBackIcon fontSize="inherit" />
        </IconButton>
      }
    >
      {loadError}
    </Alert>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header with back button */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            component={RouterLink}
            to="/admin/users"
            aria-label="Back to users"
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" fontWeight="bold">
            {isEditMode ? 'Edit User' : 'New User'}
          </Typography>
        </Box>

        {/* Submit error alert */}
        {submitError && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setSubmitError(null)}
          >
            {submitError}
          </Alert>
        )}

        {/* Content */}
        {isLoadingUser ? (
          renderLoadingSkeleton()
        ) : loadError ? (
          renderError()
        ) : (
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
            <UserForm
              initialValues={getInitialValues()}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              mode={mode}
            />
          </Paper>
        )}

        {/* Success Toast */}
        <Snackbar
          open={showSuccessToast}
          autoHideDuration={3000}
          onClose={handleCloseToast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseToast}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {successMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
}
