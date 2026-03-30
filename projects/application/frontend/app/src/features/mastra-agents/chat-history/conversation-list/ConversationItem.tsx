import React, { useState } from 'react';
import { IconButton, Box, Typography } from '@mui/material';
import { Conversation } from '../types';
import DeleteIcon from '@mui/icons-material/Delete';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  className?: string;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onDelete,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Box
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
        position: 'relative',
        py: 0.75,
        px: 0.75,
        borderRadius: '8px',
        '&:hover': {
          bgcolor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.03)',
        },
        ...(isActive && {
          bgcolor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.05)',
        }),
      }}
    >
      <Box sx={{ pr: 3 }}>
        <Typography
          variant="body2"
          fontWeight={isActive ? 600 : 400}
          noWrap
          title={conversation.title}
          sx={{
            fontSize: '0.875rem',
            lineHeight: 1.7,
          }}
        >
          {conversation.title}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={handleDeleteClick}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 4,
          my: 'auto',
          height: 'fit-content',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s',
          padding: '4px',
          '&:hover': {
            color: 'error.main',
            bgcolor: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(255, 76, 79, 0.15)'
              : 'rgba(255, 76, 79, 0.1)',
          },
        }}
      >
        <DeleteIcon sx={{ fontSize: '1rem' }} />
      </IconButton>
    </Box>
  );
};
