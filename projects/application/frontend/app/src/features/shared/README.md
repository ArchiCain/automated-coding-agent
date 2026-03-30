# @packages/shared

Reusable UI components and utilities shared across the frontend application.

## Purpose

This package provides common React components and utilities used throughout the frontend application. It serves as a centralized location for components that are shared across multiple features or pages, reducing duplication and maintaining consistency.

## Usage

### ConfirmationModal

A Material-UI based confirmation dialog component for user confirmations (e.g., deleting resources, confirming actions).

```typescript
import { ConfirmationModal } from '@packages/shared';
import { useState } from 'react';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = () => {
    // Perform delete action
    setIsOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Delete Item</button>

      <ConfirmationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
        cancelText="Cancel"
      />
    </>
  );
}
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `ConfirmationModal` | React.FC | A Material-UI dialog component for user confirmations |
| `ConfirmationModalProps` | Interface | Props interface for ConfirmationModal component |

## ConfirmationModalProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | boolean | Yes | - | Controls visibility of the modal |
| `onClose` | () => void | Yes | - | Callback fired when modal is closed (cancel button) |
| `onConfirm` | () => void | Yes | - | Callback fired when confirm button is clicked |
| `title` | string | Yes | - | The dialog title |
| `message` | string | Yes | - | The confirmation message to display |
| `confirmText` | string | No | 'Confirm' | Text for the confirm button |
| `confirmColor` | 'error' \| 'primary' \| 'secondary' \| 'success' \| 'warning' \| 'info' \| 'inherit' | No | 'error' | Color variant for the confirm button |
| `cancelText` | string | No | 'Cancel' | Text for the cancel button |

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports |
| `components/ConfirmationModal.tsx` | Confirmation modal component |

## Dependencies

- `react` - React library for component development
- `@mui/material` - Material-UI components (Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography)

## Notes

- The component uses Material-UI's Dialog component for accessibility and consistent styling
- The confirm button defaults to the 'error' color, which is suitable for destructive actions like deletions
- All text labels can be customized via props for internationalization support
