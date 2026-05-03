/**
 * /telemetry — public-facing transparency page.
 *
 * Shows the *exact* JSON that would be sent if telemetry is enabled, the
 * independent toggles, the live status (last ping, last update check),
 * and the receiver's retention policy. Linked from the setup wizard, the
 * settings panel, and the README — same way HTTPS-only and 2FA are
 * surfaced.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { telemetryService, fetchPublicStats } from '../services/telemetryService';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import { toast } from '../stores/toastStore';

export default function TelemetryPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const status = useQuery({
    queryKey: ['telemetry-status'],
    queryFn: telemetryService.status,
    enabled: isAuthed,
  });
  const payload = useQuery({
    queryKey: ['telemetry-payload'],
    queryFn: telemetryService.payload,
    enabled: isAuthed,
  });
  // Public aggregate from the central receiver — no auth, no per-install
  // data, just the headline number visible to anyone.
  const publicStats = useQuery({
    queryKey: ['telemetry-public-stats'],
    queryFn: fetchPublicStats,
    refetchInterval: 60_000,
  });

  const setPrefs = useMutation({
    mutationFn: telemetryService.setPreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['telemetry-status'] });
      toast.success('Telemetry preferences saved');
    },
    onError: () => toast.error('Failed to save preferences'),
  });

  const ping = useMutation({
    mutationFn: telemetryService.ping,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['telemetry-status'] });
      if (r.ok) toast.success('Ping submitted');
      else toast.error(r.error === 'telemetry-disabled' ? 'Enable telemetry first' : `Failed: ${r.error}`);
    },
  });
  const checkUpdates = useMutation({
    mutationFn: telemetryService.checkUpdates,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['telemetry-status'] });
      if (r.upgradeAvailable) toast.success(`Update available: ${r.latest}`);
      else toast.success(`Up to date (${r.current})`);
    },
    onError: () => toast.error('Update check failed'),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(isAuthed ? '/sessions' : '/login')}
            className="rounded-md p-1.5 hover:bg-accent text-muted-foreground"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" /> Telemetry
            </h1>
            <p className="text-xs text-muted-foreground">
              What we collect, when, and how we keep it from being a tracking surface.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Public aggregate — what every install sees, no auth */}
        <section className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Reported install pings · this week
              </p>
              <p className="text-4xl font-bold tracking-tight mt-1">
                {publicStats.data
                  ? publicStats.data.installs.toLocaleString()
                  : publicStats.isLoading
                  ? '…'
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Salted-hash dedupe, ISO week{' '}
                <code>{publicStats.data?.week || '…'}</code>. Counts unique
                <code className="mx-1">SHA-256(salt || ip || installation_id)</code>
                values. Anyone can hit{' '}
                <a className="text-primary underline" href="https://telemetry.danimoya.com/v1/stats">
                  /v1/stats
                </a>
                .
              </p>
            </div>
            {publicStats.data?.byVersion && publicStats.data.byVersion.length > 0 && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  By version
                </p>
                <ul className="text-sm mt-1 font-mono">
                  {publicStats.data.byVersion.slice(0, 5).map((v) => (
                    <li key={v.version}>
                      <span className="text-primary">{v.version}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{v.installs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* TL;DR */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-2">
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <ShieldCheck size={16} /> TL;DR
          </div>
          <p className="text-sm leading-relaxed">
            Telemetry is <strong>opt-in and off by default</strong>. When enabled, the dashboard
            posts a tiny weekly ping containing four fields and nothing else. We do not send
            your IP, username, host metadata, or any contents from your sessions. The receiver
            keeps a <strong>salted hash</strong> of <code>(IP, install_id)</code> bucketed by
            week to dedupe active installs without retaining a re-identifiable address. You
            get to "X anonymous installs reported pings this week"; nobody gets a list of
            who you are.
          </p>
        </section>

        {/* Exact payload */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Exact payload</h2>
          <p className="text-sm text-muted-foreground">
            This is the precise JSON the dashboard would POST to the telemetry endpoint right
            now. Nothing else accompanies it — no headers beyond <code>Content-Type</code>,
            no cookies, no auth token.
          </p>
          <pre className="bg-zinc-950 dark:bg-zinc-900 text-zinc-100 rounded-md p-4 text-xs overflow-x-auto border border-zinc-800">
            {payload.data ? JSON.stringify(payload.data, null, 2) : '(loading…)'}
          </pre>
          <table className="w-full text-sm border border-border rounded">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Field</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Source</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">PII risk</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <Row k="installation_id" src="random 16-byte hex, generated once on first boot" risk="none — opaque to us" />
              <Row k="dashboard_version" src="value of $DASHBOARD_VERSION at build time" risk="none" />
              <Row k="heliosdb_version" src="`SELECT version()` parsed for the Nano version string" risk="none" />
              <Row k="timestamp" src="`new Date().toISOString()` at submit time" risk="none" />
            </tbody>
          </table>
        </section>

        {/* Toggles + buttons */}
        {isAuthed && (
          <section className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Your preferences</h2>
            <div className="space-y-3">
              <Toggle
                checked={status.data?.telemetryEnabled ?? false}
                onChange={(v) => setPrefs.mutate({ telemetry: v })}
                disabled={setPrefs.isPending}
                title="Submit install pings"
                description="Sends the JSON above. Independent of the update-check button."
              />
              <Toggle
                checked={status.data?.updateChecksEnabled ?? false}
                onChange={(v) => setPrefs.mutate({ updates: v })}
                disabled={setPrefs.isPending}
                title="Check for updates"
                description="GET against a public JSON feed. No payload sent from this dashboard."
              />
            </div>

            <div className="border-t border-border pt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => checkUpdates.mutate()}
                isLoading={checkUpdates.isPending}
              >
                <RefreshCw size={14} className="mr-1" /> Check for updates
              </Button>
              <Button
                size="sm"
                onClick={() => ping.mutate()}
                isLoading={ping.isPending}
                disabled={!status.data?.telemetryEnabled}
              >
                <Send size={14} className="mr-1" /> Send ping now
              </Button>
              <span className="ml-auto text-xs text-muted-foreground self-center">
                Last ping: {status.data?.lastPingAt ? new Date(status.data.lastPingAt).toLocaleString() : 'never'}
                {' · '}
                Last update check: {status.data?.lastUpdateCheckAt ? new Date(status.data.lastUpdateCheckAt).toLocaleString() : 'never'}
              </span>
            </div>
          </section>
        )}

        {/* Receiver retention */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Receiver retention policy</h2>
          <ul className="text-sm space-y-1.5 list-disc pl-5 marker:text-primary">
            <li>
              The receiving service hashes <code>(client_ip, installation_id)</code> with a
              rotating server-side salt and bucket-key <code>YYYY-W</code>. The raw IP and the
              raw <code>(ip, id)</code> tuple are <strong>never persisted</strong>.
            </li>
            <li>
              Only <code>(week_bucket, hash)</code> rows are kept, plus the dashboard / Nano
              version columns. The "active installs this week" number is{' '}
              <code>SELECT COUNT(DISTINCT hash) WHERE week_bucket = current_week</code>.
            </li>
            <li>
              Salt rotates weekly. Hashes from week <code>N</code> can never be cross-correlated
              with hashes from week <code>N+1</code> at the receiver.
            </li>
            <li>Aggregate counts retained forever. Per-row data dropped after 90 days.</li>
            <li>
              No third-party processors, no analytics SDKs, no client-side trackers. The
              endpoint is operated by the dashboard maintainer, no resale.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Receiver source — including the schema, cron jobs, and salt-rotation script — lives
            at{' '}
            <a
              className="text-primary inline-flex items-center gap-1"
              href="https://github.com/danimoya/telemetry"
            >
              github.com/danimoya/telemetry <ExternalLink size={12} />
            </a>
            . Read it before you opt in.
          </p>
        </section>

        {/* Footer link */}
        <section className="bg-muted/40 border border-border rounded-lg p-4 text-sm flex items-start gap-3">
          <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Why we're publishing this page.</p>
            <p className="text-xs text-muted-foreground mt-1">
              The "what's it sending?" question is reasonable, and burying the answer is
              reason enough to assume the worst. Telemetry-Off is the default precisely so
              this page is allowed to be dry: nothing exists to hide.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ k, src, risk }: { k: string; src: string; risk: string }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-[12px]">{k}</td>
      <td className="px-3 py-2">{src}</td>
      <td className="px-3 py-2 text-muted-foreground">{risk}</td>
    </tr>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 py-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 mt-0.5 accent-primary"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}
