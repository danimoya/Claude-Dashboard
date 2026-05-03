/**
 * Telemetry & update-check service.
 *
 * Two clearly-separated functions:
 *
 *   1. checkUpdates() — fetches a public JSON feed and reports the latest
 *      released dashboard version. **Sends no client payload.** Pure GET.
 *
 *   2. ping() — submits the install ping. **Only runs when the user has
 *      explicitly opted in.** Payload is exactly:
 *         { installation_id, dashboard_version, heliosdb_version, timestamp }
 *      No IP, no username, no host metadata. The receiver may hash and
 *      bucket weekly for dedupe (see ~/telemetry/README.md), but the
 *      dashboard never sends a re-identifiable address.
 *
 * The `Install` entity is created on first boot (one row, ever) holding
 * the random installation_id and the two independent toggles.
 */

import { randomBytes } from 'crypto';
import { AppDataSource } from '../config/database.js';
import { Install } from '../entities/Install.entity.js';
import { logger } from '../utils/logger.js';

const TELEMETRY_ENDPOINT =
  process.env.TELEMETRY_ENDPOINT || 'https://telemetry.danimoya.com/v1/ping';
const UPDATE_FEED_URL =
  process.env.UPDATE_FEED_URL || 'https://claude-dashboard.danimoya.com/updates.json';

const DASHBOARD_VERSION = process.env.DASHBOARD_VERSION || 'dev';

export interface TelemetryStatus {
  installationId: string;
  telemetryEnabled: boolean;
  updateChecksEnabled: boolean;
  lastPingAt?: string;
  lastUpdateCheckAt?: string;
  latestVersionSeen?: string;
  dashboardVersion: string;
}

export interface UpdateCheckResult {
  current: string;
  latest?: string;
  upgradeAvailable: boolean;
  notes?: string;
  fetchedAt: string;
}

export interface TelemetryPingResult {
  ok: boolean;
  sentAt: string;
  payload: TelemetryPayload;
  receiverStatus?: number;
  error?: string;
}

export interface TelemetryPayload {
  installation_id: string;
  dashboard_version: string;
  heliosdb_version: string | null;
  timestamp: string;
}

export class TelemetryService {
  private repo = AppDataSource.getRepository(Install);

  /**
   * Idempotent: returns the single Install row, creating it (with a fresh
   * random installation_id and telemetry/updates OFF) on first call.
   */
  async getOrCreateInstall(): Promise<Install> {
    const existing = await this.repo.find({ take: 1, order: { createdAt: 'ASC' } });
    if (existing.length > 0) return existing[0];

    const install = this.repo.create({
      installationId: randomBytes(16).toString('hex'),
      telemetryEnabled: false,
      updateChecksEnabled: false,
    });
    await this.repo.save(install);
    logger.info(`Telemetry: minted installation_id ${install.installationId}`);
    return install;
  }

  async getStatus(): Promise<TelemetryStatus> {
    const install = await this.getOrCreateInstall();
    return {
      installationId: install.installationId,
      telemetryEnabled: install.telemetryEnabled,
      updateChecksEnabled: install.updateChecksEnabled,
      lastPingAt: install.lastPingAt?.toISOString(),
      lastUpdateCheckAt: install.lastUpdateCheckAt?.toISOString(),
      latestVersionSeen: install.latestVersionSeen,
      dashboardVersion: DASHBOARD_VERSION,
    };
  }

  async setPreferences(prefs: { telemetry?: boolean; updates?: boolean }): Promise<TelemetryStatus> {
    const install = await this.getOrCreateInstall();
    if (prefs.telemetry !== undefined) install.telemetryEnabled = prefs.telemetry;
    if (prefs.updates !== undefined) install.updateChecksEnabled = prefs.updates;
    install.telemetryDecidedAt = new Date();
    await this.repo.save(install);
    return this.getStatus();
  }

  /**
   * Build the exact telemetry payload — exposed so the /telemetry page can
   * show the user precisely what would be sent before they opt in.
   */
  async buildPayload(): Promise<TelemetryPayload> {
    const install = await this.getOrCreateInstall();
    return {
      installation_id: install.installationId,
      dashboard_version: DASHBOARD_VERSION,
      heliosdb_version: await this.detectHeliosdbVersion(),
      timestamp: new Date().toISOString(),
    };
  }

  async ping(): Promise<TelemetryPingResult> {
    const install = await this.getOrCreateInstall();
    if (!install.telemetryEnabled) {
      return {
        ok: false,
        sentAt: new Date().toISOString(),
        payload: await this.buildPayload(),
        error: 'telemetry-disabled',
      };
    }

    const payload = await this.buildPayload();
    try {
      const res = await fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const ok = res.ok;
      if (ok) {
        install.lastPingAt = new Date();
        await this.repo.save(install);
      }
      return {
        ok,
        sentAt: new Date().toISOString(),
        payload,
        receiverStatus: res.status,
      };
    } catch (err: any) {
      return {
        ok: false,
        sentAt: new Date().toISOString(),
        payload,
        error: err?.message || 'network error',
      };
    }
  }

  async checkUpdates(): Promise<UpdateCheckResult> {
    try {
      const res = await fetch(UPDATE_FEED_URL, { method: 'GET' });
      if (!res.ok) {
        return {
          current: DASHBOARD_VERSION,
          upgradeAvailable: false,
          fetchedAt: new Date().toISOString(),
          notes: `Feed returned HTTP ${res.status}`,
        };
      }
      const feed = (await res.json()) as { latest?: string; notes?: string };
      const install = await this.getOrCreateInstall();
      install.lastUpdateCheckAt = new Date();
      install.latestVersionSeen = feed.latest;
      await this.repo.save(install);

      return {
        current: DASHBOARD_VERSION,
        latest: feed.latest,
        notes: feed.notes,
        upgradeAvailable:
          feed.latest !== undefined && feed.latest !== DASHBOARD_VERSION,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        current: DASHBOARD_VERSION,
        upgradeAvailable: false,
        fetchedAt: new Date().toISOString(),
        notes: `Fetch failed: ${err?.message || 'unknown'}`,
      };
    }
  }

  /**
   * Probe the running database for HeliosDB-Nano version. Returns null on
   * a stock Postgres or when the query fails. Used by buildPayload(); the
   * value is informational and never PII.
   */
  private async detectHeliosdbVersion(): Promise<string | null> {
    try {
      const result = await AppDataSource.query('SELECT version() AS v');
      const v = String(result?.[0]?.v ?? '');
      const m = v.match(/HeliosDB[^\s]*\s*Nano\s*([0-9.]+)/i);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }
}

export const telemetryService = new TelemetryService();
