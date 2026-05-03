/**
 * Telemetry & first-run setup API client. Mirrors
 * backend/src/routes/{telemetry,setup}.routes.ts.
 */

import { api } from './api';

export interface TelemetryStatus {
  installationId: string;
  telemetryEnabled: boolean;
  updateChecksEnabled: boolean;
  lastPingAt?: string;
  lastUpdateCheckAt?: string;
  latestVersionSeen?: string;
  dashboardVersion: string;
}

export interface TelemetryPayload {
  installation_id: string;
  dashboard_version: string;
  heliosdb_version: string | null;
  timestamp: string;
}

export interface TelemetryPingResult {
  ok: boolean;
  sentAt: string;
  payload: TelemetryPayload;
  receiverStatus?: number;
  error?: string;
}

export interface UpdateCheckResult {
  current: string;
  latest?: string;
  upgradeAvailable: boolean;
  notes?: string;
  fetchedAt: string;
}

export const telemetryService = {
  async status(): Promise<TelemetryStatus> {
    const r = await api.get('/api/v1/telemetry/status');
    return r.data.data;
  },
  async payload(): Promise<TelemetryPayload> {
    const r = await api.get('/api/v1/telemetry/payload');
    return r.data.data;
  },
  async setPreferences(prefs: { telemetry?: boolean; updates?: boolean }): Promise<TelemetryStatus> {
    const r = await api.post('/api/v1/telemetry/preferences', prefs);
    return r.data.data;
  },
  async ping(): Promise<TelemetryPingResult> {
    const r = await api.post('/api/v1/telemetry/ping');
    return r.data.data;
  },
  async checkUpdates(): Promise<UpdateCheckResult> {
    const r = await api.post('/api/v1/telemetry/check-updates');
    return r.data.data;
  },
};

// Setup wizard

export interface SetupStatus {
  needsSetup: boolean;
}

export interface SetupBootstrapDto {
  username: string;
  password: string;
  email?: string;
  enableTelemetry?: boolean;
  enableUpdateChecks?: boolean;
}

export const setupService = {
  async status(): Promise<SetupStatus> {
    const r = await api.get('/api/v1/setup/status');
    return r.data.data;
  },
  async bootstrap(dto: SetupBootstrapDto) {
    const r = await api.post('/api/v1/setup/bootstrap', dto);
    return r.data.data;
  },
};
