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

let cooldownIntervalId: ReturnType<typeof setInterval> | null = null;

function startCooldown(set: (partial: Partial<AuthStore>) => void) {
  stopCooldown();
  cooldownIntervalId = setInterval(() => {
    // Use getState() inside the callback so we always read the latest value
    const current = useAuthStore.getState().cooldownSeconds;
    if (current <= 1) {
      stopCooldown();
      set({ cooldownSeconds: 0 });
      return;
    }
    set({ cooldownSeconds: current - 1 });
  }, 1000);
}

function stopCooldown() {
  if (cooldownIntervalId !== null) {
    clearInterval(cooldownIntervalId);
    cooldownIntervalId = null;
  }
}

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
  closeAuth: () => {
    stopCooldown();
    set({ isAuthOpen: false, error: null, cooldownSeconds: 0 });
  },
  requestCode: async (email) => {
    set({ isPending: true, error: null });
    try {
      const response = await requestEmailCode(email);
      set({
        cooldownSeconds: response.cooldownSeconds,
      });
      startCooldown(set);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to send the verification code.';
      set({ error: message });
    } finally {
      set({ isPending: false });
    }
  },
  login: async (email, code) => {
    set({ isPending: true, error: null });
    try {
      const tokens = await loginWithEmailCode(email, code);
      writeAuthSession(tokens);
      stopCooldown();
      set({
        user: tokens.user ?? null,
        isAuthOpen: false,
        cooldownSeconds: 0,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The verification code is invalid or expired.';
      set({ error: message });
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
      stopCooldown();
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
