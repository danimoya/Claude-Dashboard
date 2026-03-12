/**
 * Settings Page
 * User profile, API keys, and preferences management
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { userService } from '../services/userService';
import Button from '../components/Button';
import Input from '../components/Input';
import { User, Key, Palette, Eye, EyeOff } from 'lucide-react';
import { toast } from '../stores/toastStore';

type TabId = 'profile' | 'api-keys' | 'preferences';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
  { id: 'preferences', label: 'Preferences', icon: <Palette size={16} /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
    </div>
  );
}

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
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update profile');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => userService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to change password');
    },
  });

  return (
    <div className="space-y-8">
      {/* Profile Info */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
        <div className="space-y-4 max-w-md">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {profileMutation.isError && (
            <p className="text-sm text-destructive">
              {(profileMutation.error as any)?.response?.data?.error || 'Failed to update profile'}
            </p>
          )}
          <Button onClick={() => profileMutation.mutate()} isLoading={profileMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Change Password */}
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
          {passwordMutation.isError && (
            <p className="text-sm text-destructive">
              {(passwordMutation.error as any)?.response?.data?.error || 'Failed to change password'}
            </p>
          )}
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
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to save API keys');
    },
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
        {/* Theme */}
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

        {/* Editor Font Size */}
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
          <p className="text-xs text-muted-foreground mt-1">Controls font size in terminal and code views (10-32px)</p>
        </div>
      </div>
    </div>
  );
}
