/**
 * Settings Page
 *
 * Profile, API keys, preferences, and security (2FA). When the user has 2FA
 * enabled, viewing this page requires a TOTP step-up. The step-up token lives
 * in sessionStorage and is cleared on logout / tab close.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { userService } from '../services/userService';
import { twofaService } from '../services/twofaService';
import Button from '../components/Button';
import Input from '../components/Input';
import { User, Key, Palette, Eye, EyeOff, ShieldCheck, ShieldAlert, Loader2, BarChart3 } from 'lucide-react';
import { toast } from '../stores/toastStore';

type TabId = 'profile' | 'api-keys' | 'preferences' | 'security' | 'telemetry';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
  { id: 'preferences', label: 'Preferences', icon: <Palette size={16} /> },
  { id: 'security', label: 'Security', icon: <ShieldCheck size={16} /> },
  { id: 'telemetry', label: 'Telemetry', icon: <BarChart3 size={16} /> },
];

const STEP_UP_KEY = '2faToken';
const STEP_UP_EXP_KEY = '2faTokenExpires';

function readStepUp(): { token: string; expiresAt: number } | null {
  try {
    const t = sessionStorage.getItem(STEP_UP_KEY);
    const e = Number(sessionStorage.getItem(STEP_UP_EXP_KEY) || 0);
    if (!t || !e || Date.now() >= e) return null;
    return { token: t, expiresAt: e };
  } catch {
    return null;
  }
}

function writeStepUp(t: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(STEP_UP_KEY, t);
    sessionStorage.setItem(STEP_UP_EXP_KEY, String(expiresAt));
  } catch {
    /* ignore */
  }
}

function clearStepUp(): void {
  try {
    sessionStorage.removeItem(STEP_UP_KEY);
    sessionStorage.removeItem(STEP_UP_EXP_KEY);
  } catch {
    /* ignore */
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Check 2FA status — if enabled and no step-up token, gate the page.
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: twofaService.status,
  });

  const [hasStepUp, setHasStepUp] = useState<boolean>(() => !!readStepUp());

  // Re-check on tab visibility change in case the token expired.
  useEffect(() => {
    const refresh = () => setHasStepUp(!!readStepUp());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const needsChallenge = !!status?.enabled && !hasStepUp;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={16} /> Loading…
      </div>
    );
  }

  if (needsChallenge) {
    return <Challenge onSuccess={() => setHasStepUp(true)} />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'api-keys' && <ApiKeysTab />}
      {activeTab === 'preferences' && <PreferencesTab />}
      {activeTab === 'security' && (
        <SecurityTab
          enabled={!!status?.enabled}
          onEnabledChange={() => {
            // status will re-fetch; clear the step-up so the next visit
            // re-challenges if 2FA was just turned off-then-on.
          }}
        />
      )}
      {activeTab === 'telemetry' && <TelemetryRedirect />}
    </div>
  );
}

function TelemetryRedirect() {
  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-primary" />
        <h3 className="text-lg font-semibold">Telemetry &amp; updates</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Both the telemetry-ping toggle and the update-check toggle live on the dedicated{' '}
        <a className="text-primary underline" href="/telemetry">/telemetry</a> page,
        alongside the exact JSON payload that would be sent and the receiver's retention
        policy. We keep them there (rather than buried in a settings tab) so the controls
        and the disclosure stay visible together.
      </p>
      <a
        href="/telemetry"
        className="inline-flex items-center gap-1.5 text-sm text-primary underline"
      >
        Open /telemetry →
      </a>
    </div>
  );
}

// ── 2FA Challenge ───────────────────────────────────────────────

function Challenge({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const verify = useMutation({
    mutationFn: () => twofaService.verify(code),
    onSuccess: (data) => {
      writeStepUp(data.token, data.expiresAt);
      toast.success('2FA verified');
      onSuccess();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Invalid code'),
  });

  return (
    <div className="max-w-sm mx-auto pt-16">
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" />
          <h2 className="text-lg font-semibold">Two-factor verification</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Settings hold sensitive credentials. Enter your authenticator code
          (or a backup code) to continue.
        </p>
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456 or backup-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code) verify.mutate();
          }}
        />
        <Button
          onClick={() => verify.mutate()}
          isLoading={verify.isPending}
          disabled={code.length < 4}
          className="w-full"
        >
          Verify
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Lost access? Run <code className="font-mono bg-muted px-1 py-0.5 rounded">~/scripts/2fa-admin.sh disable &lt;username&gt;</code> on the host.
        </p>
      </div>
    </div>
  );
}

// ── Profile ─────────────────────────────────────────────────────

function ProfileTab() {
  const { user, updateUser } = useAuthStore();
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const profileMutation = useMutation({
    mutationFn: () => userService.updateProfile({ username, email: email || undefined }),
    onSuccess: (data) => {
      updateUser(data);
      toast.success('Profile updated');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: () => userService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to change password'),
  });

  return (
    <div className="space-y-8">
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
        <div className="space-y-4 max-w-md">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={() => profileMutation.mutate()} isLoading={profileMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
        <div className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            helperText="Minimum 8 characters"
          />
          <Button
            onClick={() => passwordMutation.mutate()}
            isLoading={passwordMutation.isPending}
            disabled={!currentPassword || newPassword.length < 8}
          >
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── API Keys (now requires 2FA on the backend) ─────────────────

function ApiKeysTab() {
  const [keys, setKeys] = useState({ anthropic: '', openai: '', speechmatics: '' });
  const [showKeys, setShowKeys] = useState({ anthropic: false, openai: false, speechmatics: false });

  const mutation = useMutation({
    mutationFn: () => {
      const toSend: Record<string, string> = {};
      if (keys.anthropic) toSend.anthropic = keys.anthropic;
      if (keys.openai) toSend.openai = keys.openai;
      if (keys.speechmatics) toSend.speechmatics = keys.speechmatics;
      return userService.updateApiKeys(toSend);
    },
    onSuccess: () => {
      setKeys({ anthropic: '', openai: '', speechmatics: '' });
      toast.success('API keys saved');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to save API keys'),
  });

  const renderKeyInput = (label: string, key: keyof typeof keys, placeholder: string) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={showKeys[key] ? 'text' : 'password'}
          value={keys[key]}
          onChange={(e) => setKeys({ ...keys, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setShowKeys({ ...showKeys, [key]: !showKeys[key] })}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showKeys[key] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold mb-2">API Keys</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Keys are encrypted and stored securely. Leave blank to keep existing keys.
      </p>
      <div className="space-y-4 max-w-md">
        {renderKeyInput('Anthropic API Key', 'anthropic', 'sk-ant-...')}
        {renderKeyInput('OpenAI API Key', 'openai', 'sk-...')}
        {renderKeyInput('Speechmatics API Key', 'speechmatics', 'Enter key...')}
        <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
          Save API Keys
        </Button>
      </div>
    </div>
  );
}

// ── Preferences ─────────────────────────────────────────────────

function PreferencesTab() {
  const { theme, setTheme } = useThemeStore();
  const [editorFontSize, setEditorFontSize] = useState(14);

  const prefsMutation = useMutation({
    mutationFn: userService.updatePreferences,
    onSuccess: () => toast.success('Preferences saved'),
    onError: () => toast.error('Failed to save preferences'),
  });

  const handleThemeChange = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    prefsMutation.mutate({ theme: t });
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold mb-4">Preferences</h3>
      <div className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-2">Theme</label>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Editor Font Size</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={10}
              max={32}
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(Number(e.target.value))}
              className="w-20 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none text-sm"
            />
            <span className="text-sm text-muted-foreground">px</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => prefsMutation.mutate({ editorFontSize })}
              isLoading={prefsMutation.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Security (2FA enrollment / disable) ────────────────────────

function SecurityTab({ enabled, onEnabledChange }: { enabled: boolean; onEnabledChange: () => void }) {
  return enabled ? <Disable2FA onChanged={onEnabledChange} /> : <Enroll2FA onChanged={onEnabledChange} />;
}

function Enroll2FA({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const [enrollment, setEnrollment] = useState<{
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [code, setCode] = useState('');

  const start = useMutation({
    mutationFn: twofaService.enroll,
    onSuccess: setEnrollment,
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to start enrollment'),
  });

  const confirm = useMutation({
    mutationFn: () => twofaService.confirm(code),
    onSuccess: ({ stepUp }) => {
      writeStepUp(stepUp.token, stepUp.expiresAt);
      toast.success('Two-factor enabled');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      setEnrollment(null);
      setCode('');
      onChanged();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Invalid code'),
  });

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-amber-500" />
        <h3 className="text-lg font-semibold">Two-factor authentication</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Settings holds API keys and other credentials. Enable TOTP-based 2FA
        to require a 6-digit code on each visit. Compatible with any authenticator
        app (1Password, Authy, Google Authenticator, etc.).
      </p>

      {!enrollment ? (
        <Button onClick={() => start.mutate()} isLoading={start.isPending}>
          <ShieldCheck size={14} className="mr-1.5" /> Begin enrollment
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Scan QR code in your authenticator app</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  enrollment.otpauthUrl
                )}`}
                alt="2FA QR"
                className="rounded border border-border bg-white p-2"
              />
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Or enter the secret manually</summary>
              <code className="font-mono text-xs bg-background border border-border rounded px-2 py-1 block mt-2 break-all">
                {enrollment.secret}
              </code>
            </details>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Backup codes</p>
            <p className="text-xs text-muted-foreground mb-2">
              Save these now — each code works exactly once if you lose your authenticator.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              {enrollment.backupCodes.map((c) => (
                <code key={c} className="px-2 py-1 bg-background border border-border rounded">
                  {c}
                </code>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Enter the 6-digit code from your app</label>
            <Input
              autoFocus
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </div>
          <Button onClick={() => confirm.mutate()} isLoading={confirm.isPending} disabled={code.length !== 6}>
            Confirm and enable
          </Button>
        </div>
      )}
    </div>
  );
}

function Disable2FA({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');

  const disable = useMutation({
    mutationFn: () => twofaService.disable(code),
    onSuccess: () => {
      clearStepUp();
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      toast.success('Two-factor disabled');
      onChanged();
      setCode('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Invalid code'),
  });

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-green-500" />
        <h3 className="text-lg font-semibold">Two-factor authentication is on</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        To disable, enter your current TOTP code (or a backup code).
      </p>
      <Input
        inputMode="numeric"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456 or backup-code"
      />
      <Button variant="danger" onClick={() => disable.mutate()} isLoading={disable.isPending} disabled={code.length < 4}>
        Disable 2FA
      </Button>
      <p className="text-xs text-muted-foreground">
        Locked out? Run on the host:{' '}
        <code className="font-mono bg-muted px-1 py-0.5 rounded">~/scripts/2fa-admin.sh disable &lt;username&gt;</code>
      </p>
    </div>
  );
}
