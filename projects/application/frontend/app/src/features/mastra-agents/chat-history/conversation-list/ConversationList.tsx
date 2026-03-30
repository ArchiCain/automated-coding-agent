import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useHistoryContext } from '../HistoryProvider';
import { conversationListService } from './conversation-list.service';
import { ConversationItem } from './ConversationItem';
import { Conversation, ChatHistoryEvent } from '../types';
import { ConfirmationModal } from '@/features/shared';

interface ConversationListProps {
  activeThreadId: string;
  onSelectConversation: (threadId: string) => void;
  onDeleteConversation: (threadId: string) => void;
  className?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  activeThreadId,
  onSelectConversation,
  onDeleteConversation,
  className,
}) => {
  const { socket } = useHistoryContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleChatHistory = (event: ChatHistoryEvent) => {
      setConversations(event.conversations);
      setIsLoading(false);
    };

    conversationListService.onChatHistory(socket, handleChatHistory);

    return () => {
      conversationListService.offChatHistory(socket, handleChatHistory);
    };
  }, [socket]);

  const handleDeleteRequest = (conversation: Conversation) => {
    setConversationToDelete(conversation);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!socket || !conversationToDelete) return;

    try {
      await conversationListService.deleteChat(socket, conversationToDelete.threadId);
      // Optimistically update local state
      setConversations((prev) => prev.filter((c) => c.threadId !== conversationToDelete.threadId));
      onDeleteConversation(conversationToDelete.threadId);
    } catch (error) {
      // Error is handled silently - user can retry if needed
    } finally {
      setIsDeleteModalOpen(false);
      setConversationToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setConversationToDelete(null);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
        }}
      >
        <CircularProgress size={32} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Loading conversations...
        </Typography>
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No conversations yet
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.threadId}
            conversation={conversation}
            isActive={conversation.threadId === activeThreadId}
            onClick={() => onSelectConversation(conversation.threadId)}
            onDelete={() => handleDeleteRequest(conversation)}
          />
        ))}
      </Box>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${conversationToDelete?.title ?? ''}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        cancelText="Cancel"
      />
    </>
  );
};
