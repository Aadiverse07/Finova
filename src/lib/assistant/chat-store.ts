import { create } from 'zustand';
import type { AssistantContext, AssistantLink } from './engine';

/**
 * Chat state lives in a module-level store (not component state) because every page renders its own
 * shell: without this the conversation would vanish each time the assistant navigates somewhere.
 */
export type ChatMessage = { role: 'user' | 'assistant'; text: string; links?: AssistantLink[]; followUps?: string[] };

export const GREETING: ChatMessage = {
  role: 'assistant',
  text: 'Hi! I’m Finova AI. Ask me about your expenses, invoices, accounts, journal entries, GST, cash or reports — by typing or with a voice note.',
};

type ChatState = {
  open: boolean;
  messages: ChatMessage[];
  context?: AssistantContext;
  speakReplies: boolean;
  setOpen: (open: boolean) => void;
  push: (m: ChatMessage) => void;
  setContext: (c?: AssistantContext) => void;
  setSpeakReplies: (v: boolean) => void;
  reset: () => void;
};

export const useAssistantChat = create<ChatState>((set) => ({
  open: false,
  messages: [GREETING],
  context: undefined,
  speakReplies: false,
  setOpen: (open) => set({ open }),
  push: (m) => set((s) => ({ messages: [...s.messages.slice(-59), m] })),
  setContext: (context) => set({ context }),
  setSpeakReplies: (speakReplies) => set({ speakReplies }),
  reset: () => set({ messages: [GREETING], context: undefined }),
}));
