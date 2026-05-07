/**
 * Claude-B Page
 *
 * Lists Claude-B daemon sessions (formerly /tasks Sessions tab) and renders
 * each session's JSONL transcript turn-by-turn. Send Prompt and Kill surface
 * real error messages from the daemon. A banner appears when the cb daemon
 * is unreachable.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  User as UserIcon,
} from 'lucide-react';
import { claudeBService } from '../services/claudeBService';
import { useCBStream } from '../hooks/useCBStream';
import Badge from '../components/Badge';
import Button from '../components/Button';
import MarkdownView from '../components/MarkdownView';
import Modal from '../components/Modal';
import { toast } from '../stores/toastStore';

export default function ClaudeBPage() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Lightweight {installed, running} probe. Branches the offline panel into
  // "not installed" vs "not running" cases. We still call /health below to
  // get the live session count when running=true, but daemonStatus is the
  // single source of truth for online/offline.
  const status = useQuery({
    queryKey: ['cb-daemon-status'],
    queryFn: claudeBService.daemonStatus,
    refetchInterval: 30_000,
    retry: 1,
  });

  const health = useQuery({
    queryKey: ['cb-health'],
    queryFn: claudeBService.health,
    refetchInterval: 30_000,
    retry: 0,
    enabled: status.data?.running === true,
  });

  const daemonOnline = status.data?.running === true;
  const cbInstalled = status.data?.installed === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot size={22} className="text-primary" /> Claude-B
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daemon &mdash;{' '}
            {status.isLoading ? (
              <span className="text-muted-foreground">checking…</span>
            ) : daemonOnline ? (
              <span className="text-green-600 dark:text-green-400">
                online{health.data ? ` · ${health.data.sessions} session${health.data.sessions === 1 ? '' : 's'}` : ''}
                {status.data?.version ? ` · v${status.data.version}` : ''}
              </span>
            ) : cbInstalled ? (
              <span className="text-amber-600 dark:text-amber-400">installed but stopped</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">not installed</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} disabled={!daemonOnline} size="sm">
          <Plus size={16} className="mr-1.5" /> New Session
        </Button>
      </div>

      {!daemonOnline && !status.isLoading && (
        <DaemonOfflinePanel
          installed={cbInstalled}
          apiUrl={status.data?.apiUrl}
          onRetry={() => status.refetch()}
        />
      )}

      <SessionsPanel
        selectedSession={selectedSession}
        onSelectSession={setSelectedSession}
        onSendPrompt={() => setShowPromptModal(true)}
        daemonOnline={daemonOnline}
      />

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

// ── Daemon offline panel ───────────────────────────────────────

const CB_REPO_URL = 'https://github.com/danimoya/Claude-B';

/**
 * Two-box install/start hint shown on /claude-b when the daemon isn't
 * answering. The relevant box (start vs install) is highlighted based on
 * whether `cb` is on PATH; the other stays available so the user can pivot
 * (e.g. they think it's installed but the binary went missing).
 */
function DaemonOfflinePanel({
  installed,
  apiUrl,
  onRetry,
}: {
  installed: boolean;
  apiUrl?: string;
  onRetry: () => void;
}) {
  const headline = installed
    ? 'Claude-B is installed but the daemon is not running.'
    : 'Claude-B is not installed on this host.';

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{headline}</p>
          <p className="text-xs text-muted-foreground mt-1">
            The dashboard couldn't reach <code>cb</code> at{' '}
            <code>{apiUrl || 'http://127.0.0.1:3847'}</code>. Pick the case that matches your host
            below. Sessions stay disabled until the daemon answers.
          </p>
        </div>
        <a
          href={CB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs flex items-center gap-1 text-primary hover:underline shrink-0"
        >
          GitHub repo <ExternalLink size={12} />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CaseBox
          title="A · Daemon stopped"
          subtitle="cb is on PATH but the REST server isn't answering."
          highlighted={installed}
          icon={<Play size={14} />}
          steps={[
            'sudo systemctl enable --now cb-daemon.service',
            'cb -s   # verify: list sessions',
          ]}
        />
        <CaseBox
          title="B · Not installed"
          subtitle="No cb binary found. One-shot install + start."
          highlighted={!installed}
          icon={<Download size={14} />}
          steps={[
            'curl -fsSL https://claude-b.foor.tech/install | sh',
            'sudo systemctl enable --now cb-daemon.service',
          ]}
          repoLink
        />
      </div>

      <Button size="sm" variant="ghost" onClick={onRetry}>
        <RefreshCw size={13} className="mr-1" /> Re-check
      </Button>
    </div>
  );
}

function CaseBox({
  title,
  subtitle,
  steps,
  icon,
  highlighted,
  repoLink,
}: {
  title: string;
  subtitle: string;
  steps: string[];
  icon: React.ReactNode;
  highlighted: boolean;
  repoLink?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-md border p-3 space-y-2 transition-colors',
        highlighted
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background/40 opacity-90'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={clsx('h-6 w-6 rounded flex items-center justify-center', highlighted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <pre className="text-[11px] leading-snug font-mono bg-muted/50 rounded px-2 py-1.5 overflow-x-auto whitespace-pre">
{steps.join('\n')}
      </pre>
      {repoLink && (
        <a
          href={CB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          danimoya/Claude-B on GitHub <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

// ── Sessions Panel ─────────────────────────────────────────────

function SessionsPanel({
  selectedSession,
  onSelectSession,
  onSendPrompt,
  daemonOnline,
}: {
  selectedSession: string | null;
  onSelectSession: (id: string | null) => void;
  onSendPrompt: () => void;
  daemonOnline: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['cb-sessions'],
    queryFn: claudeBService.listSessions,
    refetchInterval: 5_000,
    enabled: daemonOnline,
  });

  const killMutation = useMutation({
    mutationFn: claudeBService.killSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-sessions'] });
      onSelectSession(null);
      toast.success('Session terminated');
    },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to terminate session'),
  });

  const sessions = data?.sessions ?? [];

  if (!daemonOnline) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Sessions unavailable while the daemon is offline.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sessions…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground rounded-lg border border-dashed border-border">
        <Bot size={36} className="mx-auto mb-3 opacity-40" />
        <p>No active Claude-B sessions</p>
        <p className="text-xs mt-1">Click <strong>New Session</strong> to start one.</p>
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
            <p>Select a session to view its transcript.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session Detail ─────────────────────────────────────────────

interface CBTurn {
  id: string;
  prompt?: string;
  response?: string;
  status?: string;
  timestamp?: string;
  raw?: any;
}

/**
 * The cb daemon's /transcript endpoint returns
 *   { sessionId, transcript: "<jsonl-string>" }
 * where each line is a JSON object. cb writes TWO lines per prompt:
 *   1. {id, prompt, timestamp, status: "pending"}        — when sent
 *   2. {id, prompt: "", timestamp, status: "completed", output} — when done
 * (or `failed (exit N)` on error). We merge by `id` so each turn carries
 * both prompt and response.
 */
function parseTranscript(raw: unknown): CBTurn[] {
  if (raw == null) return [];
  let str: string;
  if (typeof raw === 'string') {
    str = raw;
  } else if (typeof (raw as any)?.transcript === 'string') {
    str = (raw as any).transcript;
  } else {
    return [];
  }

  const order: string[] = [];
  const byId = new Map<string, CBTurn>();

  for (const line of str.split('\n').map((l) => l.trim()).filter(Boolean)) {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      const fallbackId = cryptoRandom();
      order.push(fallbackId);
      byId.set(fallbackId, {
        id: fallbackId,
        response: line,
        raw: { rawLine: line },
      });
      continue;
    }

    const id = obj.id || obj.promptId || cryptoRandom();
    const existing = byId.get(id);
    if (!existing) {
      order.push(id);
      byId.set(id, {
        id,
        prompt: obj.prompt || undefined,
        response: obj.output || obj.response || obj.result || obj.resultFull || obj.resultPreview,
        status: obj.status,
        timestamp: obj.timestamp,
        raw: obj,
      });
    } else {
      // Merge: completion line carries the response and the final status;
      // never overwrite a non-empty prompt with an empty one.
      if (obj.prompt && !existing.prompt) existing.prompt = obj.prompt;
      const resp = obj.output || obj.response || obj.result || obj.resultFull || obj.resultPreview;
      if (resp && !existing.response) existing.response = resp;
      if (obj.status) existing.status = obj.status;
      if (obj.timestamp) existing.timestamp = obj.timestamp;
      existing.raw = { ...existing.raw, ...obj };
    }
  }

  return order.map((id) => byId.get(id)!);
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}

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

  // Full transcript poll — separate from the live tail, so we render history
  // even when the WS just connected.
  const { data: transcriptResp, refetch, isLoading } = useQuery({
    queryKey: ['cb-transcript', sessionId],
    queryFn: () => claudeBService.getTranscript(sessionId),
    refetchInterval: 4_000,
  });

  // Latest result fallback. The cb daemon only writes a "completed" line to
  // history.jsonl in some flows (PTY mode often skips it), so prompts can
  // stay "pending" forever even though the response is sitting in
  // last-result.json. /api/sessions/:id/last surfaces that text — when the
  // session is idle and the most recent turn has no response, we attach
  // /last as the response so the user sees the actual answer.
  const { data: lastResp } = useQuery({
    queryKey: ['cb-last-output', sessionId],
    queryFn: () => claudeBService.getLastOutput(sessionId),
    refetchInterval: 4_000,
  });

  const turns = useMemo(() => {
    const parsed = parseTranscript(transcriptResp);
    const lastOutput = (lastResp as any)?.output as string | undefined;
    const sessionStatus = (lastResp as any)?.status as string | undefined;
    if (parsed.length > 0 && lastOutput && sessionStatus === 'idle') {
      const last = parsed[parsed.length - 1];
      if (!last.response && (last.status === 'pending' || !last.status)) {
        last.response = lastOutput;
        last.status = 'completed (recovered)';
      }
    }
    return parsed;
  }, [transcriptResp, lastResp]);

  const tailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tailRef.current) tailRef.current.scrollTop = tailRef.current.scrollHeight;
  }, [turns.length, stream.output]);

  const handleRefresh = async () => {
    const r = await refetch();
    const count = parseTranscript(r.data).length;
    toast.success(`Transcript refreshed (${count} turn${count === 1 ? '' : 's'})`);
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden flex flex-col h-[70vh] min-h-[420px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={16} className="text-primary shrink-0" />
          <span className="text-sm font-medium font-mono truncate">{sessionId}</span>
          {stream.connected ? (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              live
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">polling every 4s</span>
          )}
          <span className="text-xs text-muted-foreground">· {turns.length} turn{turns.length === 1 ? '' : 's'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleRefresh} title="Refresh transcript">
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

      <div ref={tailRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {isLoading && turns.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading transcript…
          </div>
        ) : turns.length === 0 && !stream.output ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <Bot size={32} className="opacity-40" />
            <p>No turns yet. Click <strong>Send Prompt</strong> to start.</p>
          </div>
        ) : (
          turns.map((t, i) => (
            <TurnView key={t.id} turn={t} defaultOpen={i === turns.length - 1} />
          ))
        )}

        {/* Live tail — anything streaming over WS that's newer than the
            polled transcript. We append it raw at the end. */}
        {stream.connected && stream.output && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-xs text-primary mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              live tail
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{stream.output}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function TurnView({ turn, defaultOpen }: { turn: CBTurn; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  const statusVariant =
    turn.status === 'complete' || turn.status === 'completed' ? 'success'
    : turn.status === 'pending' ? 'warning'
    : turn.status?.startsWith('failed') || turn.status === 'error' ? 'danger'
    : 'default';

  // Header is always visible — caret toggles the body. Without a prompt OR
  // response (e.g., raw fallback line), we collapse everything below the
  // single-line summary.
  const summary = turn.prompt
    ? turn.prompt.slice(0, 120) + (turn.prompt.length > 120 ? '…' : '')
    : turn.response
    ? turn.response.slice(0, 120) + (turn.response.length > 120 ? '…' : '')
    : '(empty turn)';

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        )}
        <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm flex-1 min-w-0 truncate font-medium">{summary}</span>
        {turn.status && (
          <Badge variant={statusVariant as any} size="sm">{turn.status}</Badge>
        )}
        {turn.timestamp && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {new Date(turn.timestamp).toLocaleTimeString()}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3 space-y-3 bg-background">
          {turn.prompt && (
            <div className="flex gap-2 items-start">
              <UserIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              <div className="flex-1 min-w-0 rounded-md bg-muted/40 px-3 py-2">
                <p className="text-sm whitespace-pre-wrap">{turn.prompt}</p>
                {turn.timestamp && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(turn.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
          {turn.response ? (
            <div className="flex gap-2 items-start">
              <Bot className="h-4 w-4 text-primary shrink-0 mt-1" />
              <div className="flex-1 min-w-0 rounded-md border border-border bg-card px-3 py-2">
                <MarkdownView source={turn.response} />
              </div>
            </div>
          ) : turn.status === 'pending' ? (
            <div className="flex gap-2 items-center text-xs text-muted-foreground pl-6">
              <Loader2 size={12} className="animate-spin" /> Waiting for response…
            </div>
          ) : null}
          {!turn.prompt && !turn.response && (
            <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
              {turn.raw?.rawLine || JSON.stringify(turn.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────

function CreateSessionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const session = await claudeBService.createSession(name || undefined);
      if (prompt.trim()) await claudeBService.sendPrompt(session.id, prompt);
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cb-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['cb-health'] });
      toast.success('Session created');
      onClose();
      setName('');
      setPrompt('');
    },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to create session'),
  });

  return (
    <Modal isOpen={isOpen} title="New Claude-B Session" onClose={onClose}>
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
            placeholder="e.g., Analyse the auth module and suggest improvements…"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} className="flex-1">
            <CheckCircle2 size={14} className="mr-1.5" />
            {prompt.trim() ? 'Create & Run' : 'Create Session'}
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

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
      setPrompt('');
    },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to send prompt'),
  });

  return (
    <Modal isOpen={isOpen} title={`Send Prompt — ${sessionId}`} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="Enter your prompt…"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
          autoFocus
        />
        <div className="flex gap-3">
          <Button onClick={() => sendMutation.mutate()} disabled={!prompt.trim()} isLoading={sendMutation.isPending} className="flex-1">
            <Send size={14} className="mr-1.5" /> Send
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function extractError(err: any): string | null {
  if (!err) return null;
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    null
  );
}
