/**
 * Authentication Store (Zustand)
 * Manages authentication state with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@shared/types';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  updateTokens: (tokens: AuthTokens) => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setAuth: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
        }),

      updateTokens: (tokens) =>
        set((state) => ({
          ...state,
          tokens,
        })),

      updateUser: (user) =>
        set((state) => ({
          ...state,
          user,
        })),
    }),
    {
      name: 'claude-dashboard-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
