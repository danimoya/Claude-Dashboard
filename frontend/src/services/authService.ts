/**
 * Authentication API Service
 */

import { api } from './api';
import { ROUTES } from '@shared/constants';
import type { LoginDto } from '@shared/schemas';
import type { User } from '@shared/types';

interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export const authService = {
  /**
   * Register a new user
   */
  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    const response = await api.post(ROUTES.AUTH.LOGIN.replace('/login', '/register'), {
      username,
      password,
      email,
    });
    return response.data.data;
  },

  /**
   * Login with username and password
   */
  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await api.post(ROUTES.AUTH.LOGIN, credentials);
    return response.data.data;
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get(ROUTES.AUTH.ME);
    return response.data.data;
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await api.post(ROUTES.AUTH.LOGOUT);
  },
};
