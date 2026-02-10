/**
 * User API Service
 */

import { api } from './api';

export const userService = {
  async updateProfile(data: { username?: string; email?: string }) {
    const response = await api.patch('/api/v1/users/profile', data);
    return response.data.data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.patch('/api/v1/users/password', { currentPassword, newPassword });
    return response.data;
  },

  async updateApiKeys(keys: { anthropic?: string; openai?: string; speechmatics?: string }) {
    const response = await api.put('/api/v1/users/api-keys', keys);
    return response.data;
  },

  async updatePreferences(prefs: { theme?: string; language?: string; editorFontSize?: number }) {
    const response = await api.put('/api/v1/users/preferences', prefs);
    return response.data.data;
  },
};
