/**
 * First-run setup wizard.
 *
 * Shown when the database has zero users (`/api/v1/setup/status` →
 * needsSetup: true). Collects the first admin's credentials and the two
 * **opt-in** telemetry toggles. Both toggles default to OFF — users who
 * care will turn them on. Each one shows the exact JSON payload that
 * would be sent (or links to /telemetry for the live preview).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, BarChart3, RefreshCw, Sparkles, ChevronRight, Lock } from 'lucide-react';
import { setupService } from '../services/telemetryService';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/Button';
import Input from '../components/Input';
import { toast } from '../stores/toastStore';

export default function SetupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();

  // If setup has already been run, redirect away — no second run allowed.
  const status = useQuery({ queryKey: ['setup-status'], queryFn: setupService.status });
  useEffect(() => {
    if (status.data && !status.data.needsSetup) navigate('/sessions', { replace: true });
  }, [status.data, navigate]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [enableTelemetry, setEnableTelemetry] = useState(false);
  const [enableUpdateChecks, setEnableUpdateChecks] = useState(false);

  const valid =
    username.length >= 3 &&
    password.length >= 8 &&
    password === confirm;

  const bootstrap = useMutation({
    mutationFn: () =>
      setupService.bootstrap({
        username,
        password,
        email: email || undefined,
        enableTelemetry,
        enableUpdateChecks,
      }),
    onSuccess: (data: any) => {
      setAuth(data.user, data.tokens);
      // Without this, SetupGate keeps the stale needsSetup:true result for
      // 60s and bounces the user from /sessions back to /setup.
      queryClient.setQueryData(['setup-status'], { needsSetup: false });
      toast.success('Welcome — setup complete');
      navigate('/sessions', { replace: true });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Setup failed'),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Claude Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One-time setup. Takes 60 seconds. None of this leaves the box unless you opt in below.
          </p>
        </div>

        {/* Step 1 — admin user */}
        <Section
          step={1}
          icon={<Lock size={16} />}
          title="Create the admin account"
          subtitle="This is the only user, for now. You can add more from /settings later."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} helperText="≥ 8 characters" />
            <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {password && confirm && password !== confirm && (
            <p className="text-xs text-destructive mt-1">Passwords don't match.</p>
          )}
        </Section>

        {/* Step 2 — 2FA hint (post-setup, in /settings) */}
        <Section
          step={2}
          icon={<ShieldCheck size={16} />}
          title="Two-factor on /settings"
          subtitle="Recommended. Enroll a TOTP authenticator from /settings → Security after first login."
        >
          <p className="text-sm text-muted-foreground">
            We don't enrol you here so you can pick the authenticator app you actually use.
            The Settings panel walks you through it: scan a QR code, save 8 backup codes, done.
          </p>
        </Section>

        {/* Step 3 — opt-in telemetry */}
        <Section
          step={3}
          icon={<BarChart3 size={16} />}
          title="Help us count installs (anonymous)"
          subtitle="Off by default. Read what's sent before you decide."
        >
          <ToggleRow
            checked={enableTelemetry}
            onChange={setEnableTelemetry}
            title="Submit weekly install pings"
            body={
              <>
                Sends exactly:{' '}
                <code className="text-xs">{'{installation_id, dashboard_version, heliosdb_version, timestamp}'}</code>
                . No IP, no username, no host metadata. The receiver hashes and buckets weekly so
                it can dedupe active installs without retaining a re-identifiable address.
                Full schema and retention at <a className="text-primary underline" href="/telemetry">/telemetry</a>.
              </>
            }
          />
          <ToggleRow
            checked={enableUpdateChecks}
            onChange={setEnableUpdateChecks}
            title="Check for updates"
            body={
              <>
                Pure GET to a public JSON feed. <strong>No payload from the client.</strong>
                Independent of the install ping above — you can enable either, both, or neither.
              </>
            }
          />
        </Section>

        <Button
          onClick={() => bootstrap.mutate()}
          disabled={!valid}
          isLoading={bootstrap.isPending}
          className="w-full"
        >
          Finish setup <ChevronRight size={14} className="ml-1" />
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          You can change the telemetry preferences any time from{' '}
          <strong>/settings → Telemetry</strong>.
        </p>
      </div>
    </div>
  );
}

// ── Layout helpers ──────────────────────────────────────────────

function Section({
  step,
  icon,
  title,
  subtitle,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 mt-0.5 rounded border-border accent-primary"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
      </div>
    </label>
  );
}

// Suppress unused warning for icon imports we keep for later UI tweaks.
void RefreshCw;
