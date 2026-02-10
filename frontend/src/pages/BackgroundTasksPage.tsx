/**
 * Background Tasks Page
 * Manages Claude-B sessions — fire-and-forget tasks, live output, notifications.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Play,
  Square,
  Trash2,
  Send,
  RefreshCw,
  Bell,
  BellOff,
  Plus,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { claudeBService, type CBSession, type CBNotification } from '../services/claudeBService';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Tabs from '../components/Tabs';
import Modal from '../components/Modal';

const tabs = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'notifications', label: 'Inbox' },
];

export default function BackgroundTasksPage() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Notification count for the tab badge
  const { data: notifCount } = useQuery({
    queryKey: ['cb-notif-count'],
    queryFn: claudeBService.getNotificationCount,
    refetchInterval: 10_000,
  });

  const health = useQuery({
    queryKey: ['cb-health'],
    queryFn: claudeBService.health,
    refetchInterval: 30_000,
    retry: 1,
  });

  const daemonOnline = health.data?.status === 'ok';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Background Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claude-B daemon &mdash;{' '}
            {health.isLoading ? (
              <span className="text-muted-foreground">checking...</span>
            ) : daemonOnline ? (
              <span className="text-green-600 dark:text-green-400">online ({health.data!.sessions} sessions)</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">offline</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} disabled={!daemonOnline} size="sm">
          <Plus size={16} className="mr-1.5" /> New Session
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs.map((t) => ({
          ...t,
          label:
            t.id === 'notifications' && notifCount?.unread
              ? `Inbox (${notifCount.unread})`
              : t.label,
        }))}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'sessions' && (
        <SessionsPanel
          selectedSession={selectedSession}
          onSelectSession={setSelectedSession}
          onSendPrompt={() => setShowPromptModal(true)}
        />
      )}

      {activeTab === 'notifications' && <NotificationsPanel />}

      {/* Create Session Modal */}
      {showCreateModal && (
        <CreateSessionModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Send Prompt Modal */}
      {showPromptModal && selectedSession && (
        <SendPromptModal
          sessionId={selectedSession}
          onClose={() => setShowPromptModal(false)}
        />
      )}
    </div>
  );
}

// ── Sessions Panel ────────────────────────────────────────────

function SessionsPanel({
  selectedSession,
  onSelectSession,
  onSendPrompt,
}: {
  selectedSession: string | null;
  onSelectSession: (id: string | null) => void;
  onSendPrompt: () => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cb-sessions'],
    queryFn: claudeBService.listSessions,
    refetchInterval: 5_000,
  });

  const killMutation = useMutation({
    mutationFn: claudeBService.killSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-sessions'] });
      onSelectSession(null);
    },
  });

  const sessions = data?.sessions ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Terminal size={40} className="mx-auto mb-3 opacity-40" />
        <p>No active Claude-B sessions</p>
        <p className="text-xs mt-1">Create a session to start a background task</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Session list */}
      <div className="lg:col-span-1 space-y-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            className={clsx(
              'w-full text-left rounded-lg border p-4 transition-all',
              selectedSession === s.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/40'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm truncate">
                {s.name || s.id}
              </span>
              <Badge variant={s.status === 'busy' ? 'warning' : 'success'}>
                {s.status}
              </Badge>
            </div>
            {s.goal && (
              <p className="text-xs text-muted-foreground truncate">{s.goal}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {s.promptCount ?? 0} prompts &middot; {s.model || 'default'}
            </p>
          </button>
        ))}
      </div>

      {/* Selected session details */}
      <div className="lg:col-span-2">
        {selectedSession ? (
          <SessionDetail
            sessionId={selectedSession}
            onSendPrompt={onSendPrompt}
            onKill={() => killMutation.mutate(selectedSession)}
            isKilling={killMutation.isPending}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground border border-border rounded-lg bg-card">
            <p>Select a session to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session Detail ────────────────────────────────────────────

function SessionDetail({
  sessionId,
  onSendPrompt,
  onKill,
  isKilling,
}: {
  sessionId: string;
  onSendPrompt: () => void;
  onKill: () => void;
  isKilling: boolean;
}) {
  const { data: output, refetch } = useQuery({
    queryKey: ['cb-output', sessionId],
    queryFn: () => claudeBService.getLastOutput(sessionId),
    refetchInterval: 3_000,
  });

  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output?.output]);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-sm font-medium">{sessionId}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => refetch()} title="Refresh output">
            <RefreshCw size={14} />
          </Button>
          <Button size="sm" onClick={onSendPrompt}>
            <Send size={14} className="mr-1" /> Send Prompt
          </Button>
          <Button size="sm" variant="destructive" onClick={onKill} isLoading={isKilling}>
            <Square size={14} className="mr-1" /> Kill
          </Button>
        </div>
      </div>

      {/* Output */}
      <pre
        ref={outputRef}
        className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-96 bg-gray-950 text-gray-200 whitespace-pre-wrap"
      >
        {output?.output || 'No output yet. Send a prompt to get started.'}
      </pre>
    </div>
  );
}

// ── Notifications Panel ───────────────────────────────────────

function NotificationsPanel() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['cb-notifications'],
    queryFn: () => claudeBService.getNotifications(),
    refetchInterval: 10_000,
  });

  const markReadMutation = useMutation({
    mutationFn: claudeBService.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['cb-notif-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: claudeBService.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['cb-notif-count'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading notifications...
      </div>
    );
  }

  const items = notifications ?? [];

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <BellOff size={40} className="mx-auto mb-3 opacity-40" />
        <p>No notifications yet</p>
        <p className="text-xs mt-1">Completed tasks will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => markAllReadMutation.mutate()}
          isLoading={markAllReadMutation.isPending}
        >
          <CheckCircle2 size={14} className="mr-1" /> Mark all read
        </Button>
      </div>

      {items.map((n) => (
        <div
          key={n.id}
          className={clsx(
            'rounded-lg border p-4',
            n.read
              ? 'border-border bg-card'
              : 'border-primary/30 bg-primary/5'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {n.exitCode === 0 ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-red-500 shrink-0" />
                )}
                <span className="text-sm font-medium truncate">
                  {n.sessionName || n.sessionId}
                </span>
                <Badge variant={n.exitCode === 0 ? 'success' : 'danger'} size="sm">
                  exit {n.exitCode}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{n.prompt}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {(n.duration / 1000).toFixed(1)}s
                </span>
                <span>{new Date(n.timestamp).toLocaleString()}</span>
              </div>
            </div>
            {!n.read && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markReadMutation.mutate(n.id)}
                title="Mark as read"
              >
                <Eye size={14} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Create Session Modal ──────────────────────────────────────

function CreateSessionModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const session = await claudeBService.createSession(name || undefined);
      if (prompt.trim()) {
        await claudeBService.sendPrompt(session.id, prompt);
      }
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['cb-health'] });
      onClose();
    },
  });

  return (
    <Modal title="New Background Task" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Session Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., refactor-auth"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Initial Prompt (optional)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g., Analyze the auth module and suggest improvements..."
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {createMutation.isError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              {(createMutation.error as any)?.response?.data?.error || 'Failed to create session'}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            className="flex-1"
          >
            <Play size={14} className="mr-1.5" />
            {prompt.trim() ? 'Create & Run' : 'Create Session'}
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Send Prompt Modal ─────────────────────────────────────────

function SendPromptModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => claudeBService.sendPrompt(sessionId, prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-output', sessionId] });
      onClose();
    },
  });

  return (
    <Modal title={`Send Prompt to ${sessionId}`} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="Enter your prompt..."
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
          autoFocus
        />

        {sendMutation.isError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">Failed to send prompt</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!prompt.trim()}
            isLoading={sendMutation.isPending}
            className="flex-1"
          >
            <Send size={14} className="mr-1.5" /> Send
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
