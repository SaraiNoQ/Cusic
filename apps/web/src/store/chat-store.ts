import type { ChatMessageVm } from '@music-ai/shared';
import { create } from 'zustand';

export const initialChatMessages: ChatMessageVm[] = [
  {
    id: 'msg_boot_assistant',
    role: 'assistant',
    text: '我是你的 AI DJ。你可以让我点歌、换风格、解释推荐，或者直接替你重排当前播放队列。',
  },
];

type ChatStore = {
  sessionId?: string;
  input: string;
  isPending: boolean;
  messages: ChatMessageVm[];
  hasHydratedSession: boolean;
  setSessionId: (sessionId?: string) => void;
  setInput: (input: string) => void;
  setPending: (isPending: boolean) => void;
  appendMessage: (message: ChatMessageVm) => void;
  upsertMessage: (message: ChatMessageVm) => void;
  updateMessageText: (messageId: string, text: string) => void;
  setMessages: (messages: ChatMessageVm[]) => void;
  resetConversation: () => void;
  setHydratedSession: (value: boolean) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: undefined,
  input: '',
  isPending: false,
  messages: initialChatMessages,
  hasHydratedSession: false,
  setSessionId: (sessionId) => set({ sessionId }),
  setInput: (input) => set({ input }),
  setPending: (isPending) => set({ isPending }),
  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  upsertMessage: (message) =>
    set((state) => {
      const index = state.messages.findIndex((item) => item.id === message.id);
      if (index === -1) {
        return { messages: [...state.messages, message] };
      }

      const messages = [...state.messages];
      messages[index] = message;
      return { messages };
    }),
  updateMessageText: (messageId, text) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, text } : message,
      ),
    })),
  setMessages: (messages) => set({ messages }),
  resetConversation: () =>
    set({
      sessionId: undefined,
      input: '',
      isPending: false,
      messages: initialChatMessages,
      hasHydratedSession: false,
    }),
  setHydratedSession: (hasHydratedSession) => set({ hasHydratedSession }),
}));
