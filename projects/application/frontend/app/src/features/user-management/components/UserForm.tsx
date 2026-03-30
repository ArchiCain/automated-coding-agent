import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Save as SaveIcon } from '@mui/icons-material';
import type { Role } from '../../keycloak-auth/permissions/permissions.types';

export type UserFormMode = 'create' | 'edit';

export interface UserFormValues {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  temporaryPassword?: string;
}

export interface UserFormProps {
  initialValues?: Partial<UserFormValues>;
  onSubmit: (values: UserFormValues) => Promise<void>;
  isLoading: boolean;
  mode: UserFormMode;
}

interface FormErrors {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  temporaryPassword?: string;
}

const defaultValues: UserFormValues = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'user',
  temporaryPassword: '',
};

export const UserForm = ({
  initialValues,
  onSubmit,
  isLoading,
  mode,
}: UserFormProps) => {
  const [values, setValues] = useState<UserFormValues>({
    ...defaultValues,
    ...initialValues,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Update form values when initialValues change (e.g., when user data loads)
  useEffect(() => {
    if (initialValues) {
      setValues({
        ...defaultValues,
        ...initialValues,
      });
    }
  }, [initialValues]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateField = (name: keyof UserFormValues, value: string): string | undefined => {
    switch (name) {
      case 'email':
        if (!value.trim()) {
          return 'Email is required';
        }
        if (!validateEmail(value)) {
          return 'Please enter a valid email address';
        }
        break;
      case 'firstName':
        if (!value.trim()) {
          return 'First name is required';
        }
        break;
      case 'lastName':
        if (!value.trim()) {
          return 'Last name is required';
        }
        break;
      case 'temporaryPassword':
        if (mode === 'create' && !value.trim()) {
          return 'Temporary password is required';
        }
        if (mode === 'create' && value.length < 8) {
          return 'Password must be at least 8 characters';
        }
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    newErrors.email = validateField('email', values.email);
    newErrors.firstName = validateField('firstName', values.firstName);
    newErrors.lastName = validateField('lastName', values.lastName);

    if (mode === 'create') {
      newErrors.temporaryPassword = validateField('temporaryPassword', values.temporaryPassword || '');
    }

    if (!values.role) {
      newErrors.role = 'Role is required';
    }

    // Remove undefined errors
    Object.keys(newErrors).forEach((key) => {
      if (newErrors[key as keyof FormErrors] === undefined) {
        delete newErrors[key as keyof FormErrors];
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (name: keyof UserFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value as string;
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (name: keyof UserFormValues) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name] as string || '');
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      temporaryPassword: mode === 'create',
    });

    if (!validateForm()) {
      return;
    }

    await onSubmit(values);
  };

  const isEditMode = mode === 'edit';

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        placeholder="Enter email address"
        value={values.email}
        onChange={handleChange('email')}
        onBlur={handleBlur('email')}
        error={touched.email && !!errors.email}
        helperText={touched.email && errors.email}
        required
        fullWidth
        margin="normal"
        disabled={isEditMode || isLoading}
        autoComplete="email"
      />

      <TextField
        id="firstName"
        name="firstName"
        label="First Name"
        type="text"
        placeholder="Enter first name"
        value={values.firstName}
        onChange={handleChange('firstName')}
        onBlur={handleBlur('firstName')}
        error={touched.firstName && !!errors.firstName}
        helperText={touched.firstName && errors.firstName}
        required
        fullWidth
        margin="normal"
        disabled={isLoading}
        autoComplete="given-name"
      />

      <TextField
        id="lastName"
        name="lastName"
        label="Last Name"
        type="text"
        placeholder="Enter last name"
        value={values.lastName}
        onChange={handleChange('lastName')}
        onBlur={handleBlur('lastName')}
        error={touched.lastName && !!errors.lastName}
        helperText={touched.lastName && errors.lastName}
        required
        fullWidth
        margin="normal"
        disabled={isLoading}
        autoComplete="family-name"
      />

      <FormControl
        fullWidth
        margin="normal"
        required
        error={touched.role && !!errors.role}
        disabled={isLoading}
      >
        <InputLabel id="role-label">Role</InputLabel>
        <Select
          labelId="role-label"
          id="role"
          name="role"
          value={values.role}
          label="Role"
          onChange={(e) => handleChange('role')({ target: { value: e.target.value } })}
          onBlur={handleBlur('role')}
        >
          <MenuItem value="user">User</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
        </Select>
        {touched.role && errors.role && <FormHelperText>{errors.role}</FormHelperText>}
      </FormControl>

      {mode === 'create' && (
        <TextField
          id="temporaryPassword"
          name="temporaryPassword"
          label="Initial Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter initial password"
          value={values.temporaryPassword || ''}
          onChange={handleChange('temporaryPassword')}
          onBlur={handleBlur('temporaryPassword')}
          error={touched.temporaryPassword && !!errors.temporaryPassword}
          helperText={
            (touched.temporaryPassword && errors.temporaryPassword) ||
            'User will use this password to log in'
          }
          required
          fullWidth
          margin="normal"
          disabled={isLoading}
          autoComplete="new-password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      )}

      <Box sx={{ mt: 3 }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          sx={{ minWidth: 160 }}
        >
          {isLoading ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
        </Button>
      </Box>
    </Box>
  );
};
