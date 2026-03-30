import { createContext, useContext, ReactNode } from 'react';

/**
 * Chat context value - provides chat state to components
 */
export interface ChatContextValue {
  userId: string;
  threadId: string;
  onThreadChange: (threadId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Chat Provider - wraps chat page to provide state to navigation drawer
 */
export function ChatProvider({
  children,
  value
}: {
  children: ReactNode;
  value: ChatContextValue;
}) {
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

/**
 * Hook to access chat context
 * Returns null if not within a ChatProvider (e.g., on non-chat pages)
 */
export function useChatContext(): ChatContextValue | null {
  return useContext(ChatContext);
}
