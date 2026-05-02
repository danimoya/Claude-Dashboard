/**
 * Background Tasks Page
 * Manages Claude-B sessions — fire-and-forget tasks, full transcript view, and
 * a mailbox-style Inbox with HTML/markdown rendering.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Play,
  Square,
  Send,
  RefreshCw,
  BellOff,
  Plus,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  Trash2,
  Zap,
  Mail,
  MailOpen,
  Inbox as InboxIcon,
} from 'lucide-react';
import { claudeBService, type CBNotification } from '../services/claudeBService';
import { useCBStream } from '../hooks/useCBStream';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Tabs from '../components/Tabs';
import Modal from '../components/Modal';
import MarkdownView from '../components/MarkdownView';
import { toast } from '../stores/toastStore';

const tabs = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'notifications', label: 'Inbox' },
];

export default function BackgroundTasksPage() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Background Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claude-B daemon &mdash;{' '}
            {health.isLoading ? (
              <span className="text-muted-foreground">checking...</span>
            ) : daemonOnline ? (
              <span className="text-green-600 dark:text-green-400">
                online ({health.data!.sessions} sessions)
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400">offline</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} disabled={!daemonOnline} size="sm">
          <Plus size={16} className="mr-1.5" /> New Session
        </Button>
      </div>

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

      {activeTab === 'notifications' && <InboxPanel />}

      <CreateSessionModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {selectedSession && (
        <SendPromptModal
          isOpen={showPromptModal}
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
      toast.success('Session terminated');
    },
    onError: () => toast.error('Failed to terminate session'),
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
              <span className="font-medium text-sm truncate">{s.name || s.id}</span>
              <Badge variant={s.status === 'busy' ? 'warning' : 'success'}>{s.status}</Badge>
            </div>
            {s.goal && <p className="text-xs text-muted-foreground truncate">{s.goal}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {s.promptCount ?? 0} prompts &middot; {s.model || 'default'}
            </p>
          </button>
        ))}
      </div>

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
  const stream = useCBStream(sessionId);

  // Poll the FULL transcript when WS is offline so the panel renders the
  // entire session, not just the last line.
  const { data: transcriptData, refetch } = useQuery({
    queryKey: ['cb-transcript', sessionId],
    queryFn: () => claudeBService.getTranscript(sessionId),
    refetchInterval: stream.connected ? false : 4_000,
  });

  const transcript: string =
    typeof transcriptData === 'string'
      ? transcriptData
      : typeof (transcriptData as any)?.transcript === 'string'
      ? (transcriptData as any).transcript
      : '';

  const displayOutput = stream.connected && stream.output ? stream.output : transcript;

  const outputRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [displayOutput]);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{sessionId}</span>
          {stream.connected ? (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              live
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">polling transcript</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!stream.connected && (
            <Button size="sm" variant="ghost" onClick={stream.reconnect} title="Try streaming">
              <Zap size={14} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => refetch()} title="Refresh transcript">
            <RefreshCw size={14} />
          </Button>
          <Button size="sm" onClick={onSendPrompt}>
            <Send size={14} className="mr-1" /> Send Prompt
          </Button>
          <Button size="sm" variant="danger" onClick={onKill} isLoading={isKilling}>
            <Square size={14} className="mr-1" /> Kill
          </Button>
        </div>
      </div>

      <pre
        ref={outputRef}
        className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[60vh] bg-zinc-950 text-zinc-200 whitespace-pre-wrap"
      >
        {displayOutput || 'No output yet. Send a prompt to get started.'}
      </pre>
    </div>
  );
}

// ── Inbox (mailbox-style) ─────────────────────────────────────

function InboxPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['cb-notifications'],
    queryFn: () => claudeBService.getNotifications(),
    refetchInterval: 10_000,
  });

  const items = useMemo(() => {
    const list = notifications ?? [];
    if (filter === 'unread') return list.filter((n) => !n.read);
    if (filter === 'read') return list.filter((n) => n.read);
    return list;
  }, [notifications, filter]);

  const open = openId ? items.find((n) => n.id === openId) ?? null : null;

  const markRead = useMutation({
    mutationFn: claudeBService.markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cb-notifications'] });
      qc.invalidateQueries({ queryKey: ['cb-notif-count'] });
    },
  });
  const markAllRead = useMutation({
    mutationFn: claudeBService.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cb-notifications'] });
      qc.invalidateQueries({ queryKey: ['cb-notif-count'] });
      toast.success('All marked as read');
    },
  });
  const del = useMutation({
    mutationFn: claudeBService.deleteNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cb-notifications'] });
      qc.invalidateQueries({ queryKey: ['cb-notif-count'] });
    },
    onError: () => toast.error('Failed to delete'),
  });
  const delRead = useMutation({
    mutationFn: claudeBService.deleteReadNotifications,
    onSuccess: ({ deleted }) => {
      qc.invalidateQueries({ queryKey: ['cb-notifications'] });
      qc.invalidateQueries({ queryKey: ['cb-notif-count'] });
      toast.success(`Deleted ${deleted} viewed`);
    },
  });
  const delAll = useMutation({
    mutationFn: claudeBService.deleteAllNotifications,
    onSuccess: ({ deleted }) => {
      qc.invalidateQueries({ queryKey: ['cb-notifications'] });
      qc.invalidateQueries({ queryKey: ['cb-notif-count'] });
      toast.success(`Deleted ${deleted}`);
      setOpenId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inbox...
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden flex flex-col h-[calc(100vh-14rem)] min-h-[480px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-2.5 py-1 text-xs rounded font-medium capitalize',
                filter === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {f}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">{items.length} message{items.length === 1 ? '' : 's'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => markAllRead.mutate()} isLoading={markAllRead.isPending}>
            <CheckCircle2 size={13} className="mr-1" /> Mark all read
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm('Delete all viewed (read) messages?')) delRead.mutate();
            }}
            isLoading={delRead.isPending}
          >
            <Trash2 size={13} className="mr-1" /> Delete viewed
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm('Delete ALL messages? This cannot be undone.')) delAll.mutate();
            }}
            isLoading={delAll.isPending}
          >
            <Trash2 size={13} className="mr-1" /> Delete all
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
          {filter === 'unread' ? <MailOpen size={36} className="opacity-40" /> : <BellOff size={36} className="opacity-40" />}
          <p className="text-sm">No messages</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(280px,360px)_1fr] overflow-hidden">
          {/* Message list */}
          <div className="overflow-y-auto border-r border-border">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpenId(n.id);
                  if (!n.read) markRead.mutate(n.id);
                }}
                className={clsx(
                  'w-full text-left px-3 py-2.5 border-b border-border flex flex-col gap-0.5',
                  openId === n.id ? 'bg-accent' : 'hover:bg-muted/40',
                  !n.read && 'bg-primary/5'
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {n.exitCode === 0 ? (
                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-red-500 shrink-0" />
                  )}
                  {!n.read ? (
                    <Mail size={12} className="text-primary shrink-0" />
                  ) : (
                    <MailOpen size={12} className="text-muted-foreground shrink-0" />
                  )}
                  <span className={clsx('text-sm truncate', !n.read && 'font-medium')}>
                    {n.sessionName || n.sessionId}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate pl-5">
                  {n.resultPreview || n.prompt || '(no preview)'}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
                  <Clock size={10} />
                  {new Date(n.timestamp).toLocaleString()}
                  <span>·</span>
                  <span>{(((n.durationMs ?? n.duration) ?? 0) / 1000).toFixed(1)}s</span>
                </div>
              </button>
            ))}
          </div>

          {/* Message viewer */}
          <div className="overflow-hidden flex flex-col">
            {open ? (
              <MessageView
                n={open}
                onMarkRead={() => markRead.mutate(open.id)}
                onDelete={() => {
                  if (confirm('Delete this message?')) {
                    del.mutate(open.id);
                    setOpenId(null);
                  }
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
                <InboxIcon size={20} className="opacity-40" />
                <span className="text-sm">Select a message to read</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageView({
  n,
  onMarkRead,
  onDelete,
}: {
  n: CBNotification;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const body = n.resultFull || n.resultPreview || n.prompt || '';
  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {n.exitCode === 0 ? (
              <CheckCircle2 size={14} className="text-green-500 shrink-0" />
            ) : (
              <XCircle size={14} className="text-red-500 shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{n.sessionName || n.sessionId}</span>
            <Badge variant={n.exitCode === 0 ? 'success' : 'danger'} size="sm">
              exit {n.exitCode}
            </Badge>
            {n.type && <Badge variant="default" size="sm">{n.type}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {new Date(n.timestamp).toLocaleString()}
            </span>
            <span>{((n.durationMs ?? n.duration ?? 0) / 1000).toFixed(1)}s</span>
            {n.goal && <span className="truncate font-mono">{n.goal}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!n.read && (
            <Button size="sm" variant="ghost" onClick={onMarkRead} title="Mark as read">
              <Eye size={13} />
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={onDelete} title="Delete">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <MarkdownView source={body} />
        {n.viewCommand && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-1">View in CLI:</p>
            <code className="font-mono text-xs px-2 py-1 bg-muted rounded">{n.viewCommand}</code>
          </div>
        )}
      </div>
    </>
  );
}

// ── Create Session Modal ──────────────────────────────────────

function CreateSessionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
      toast.success('Session created');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create session');
    },
  });

  return (
    <Modal isOpen={isOpen} title="New Background Task" onClose={onClose}>
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
          <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} className="flex-1">
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

function SendPromptModal({
  isOpen,
  sessionId,
  onClose,
}: {
  isOpen: boolean;
  sessionId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => claudeBService.sendPrompt(sessionId, prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-output', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['cb-transcript', sessionId] });
      toast.success('Prompt sent');
      onClose();
    },
    onError: () => toast.error('Failed to send prompt'),
  });

  return (
    <Modal isOpen={isOpen} title={`Send Prompt to ${sessionId}`} onClose={onClose}>
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
