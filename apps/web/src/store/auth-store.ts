import type { AuthUserDto } from '@music-ai/shared';
import { create } from 'zustand';
import {
  fetchCurrentUser,
  loginWithEmailCode,
  logoutWithRefreshToken,
  requestEmailCode,
} from '../lib/api/auth-api';
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from '../lib/api/auth-session';

type AuthStore = {
  user: AuthUserDto | null;
  isAuthOpen: boolean;
  isPending: boolean;
  error: string | null;
  cooldownSeconds: number;
  hydrate: () => Promise<void>;
  openAuth: () => void;
  closeAuth: () => void;
  requestCode: (email: string) => Promise<void>;
  login: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthOpen: false,
  isPending: false,
  error: null,
  cooldownSeconds: 0,
  hydrate: async () => {
    const session = readAuthSession();
    if (!session) {
      return;
    }

    set({ user: session.user, error: null });
    try {
      const user = await fetchCurrentUser();
      writeAuthSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: 0,
        user,
      });
      set({ user });
    } catch {
      clearAuthSession();
      set({ user: null });
    }
  },
  openAuth: () => set({ isAuthOpen: true, error: null }),
  closeAuth: () => set({ isAuthOpen: false, error: null }),
  requestCode: async (email) => {
    set({ isPending: true, error: null });
    try {
      const response = await requestEmailCode(email);
      set({
        cooldownSeconds: response.cooldownSeconds,
      });
    } catch {
      set({ error: 'Unable to send the verification code.' });
    } finally {
      set({ isPending: false });
    }
  },
  login: async (email, code) => {
    set({ isPending: true, error: null });
    try {
      const tokens = await loginWithEmailCode(email, code);
      writeAuthSession(tokens);
      set({
        user: tokens.user ?? null,
        isAuthOpen: false,
        cooldownSeconds: 0,
      });
    } catch {
      set({ error: 'The verification code is invalid or expired.' });
    } finally {
      set({ isPending: false });
    }
  },
  logout: async () => {
    const session = readAuthSession();
    set({ isPending: true, error: null });
    try {
      if (session?.refreshToken) {
        await logoutWithRefreshToken(session.refreshToken);
      }
    } finally {
      clearAuthSession();
      set({
        user: null,
        isAuthOpen: false,
        isPending: false,
        error: null,
        cooldownSeconds: 0,
      });
    }
  },
}));
