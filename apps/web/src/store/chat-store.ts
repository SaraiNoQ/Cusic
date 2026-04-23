import type { ChatMessageVm } from '@music-ai/shared';
import { create } from 'zustand';

type ChatStore = {
  sessionId?: string;
  input: string;
  isPending: boolean;
  messages: ChatMessageVm[];
  setSessionId: (sessionId?: string) => void;
  setInput: (input: string) => void;
  setPending: (isPending: boolean) => void;
  appendMessage: (message: ChatMessageVm) => void;
};

const initialMessages: ChatMessageVm[] = [
  {
    id: 'msg_boot_assistant',
    role: 'assistant',
    text: '我是你的 AI DJ。你可以让我点歌、换风格、解释推荐，或者直接替你重排当前播放队列。',
  },
];

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: undefined,
  input: '',
  isPending: false,
  messages: initialMessages,
  setSessionId: (sessionId) => set({ sessionId }),
  setInput: (input) => set({ input }),
  setPending: (isPending) => set({ isPending }),
  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
}));
