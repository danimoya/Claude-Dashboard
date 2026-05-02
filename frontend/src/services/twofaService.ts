/**
 * 2FA API client. Backed by /api/v1/auth/2fa/*.
 */

import { api } from './api';

export interface TwoFAStatus {
  enabled: boolean;
}

export interface TwoFAEnrollment {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export interface TwoFAStepUp {
  token: string;
  expiresAt: number;
}

export const twofaService = {
  async status(): Promise<TwoFAStatus> {
    const r = await api.get('/api/v1/auth/2fa/status');
    return r.data.data;
  },
  async enroll(): Promise<TwoFAEnrollment> {
    const r = await api.post('/api/v1/auth/2fa/enroll');
    return r.data.data;
  },
  async confirm(token: string): Promise<{ enabled: boolean; stepUp: TwoFAStepUp }> {
    const r = await api.post('/api/v1/auth/2fa/confirm', { token });
    return r.data.data;
  },
  async verify(token: string): Promise<TwoFAStepUp> {
    const r = await api.post('/api/v1/auth/2fa/verify', { token });
    return r.data.data;
  },
  async disable(token: string): Promise<{ enabled: boolean }> {
    const r = await api.post('/api/v1/auth/2fa/disable', { token });
    return r.data.data;
  },
};
