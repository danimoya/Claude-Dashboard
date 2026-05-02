/**
 * TmuxView
 *
 * Two-pane layout: session list on the left, attached pane viewer +
 * key/hotkey toolbar on the right. Pane content is streamed live via the
 * /tmux Socket.IO namespace. Send-keys emits send-keys on the same socket.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Terminal,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react';
import { tmuxService, type TmuxSession, type TmuxPane } from '../../services/tmuxService';
import { useTmuxStream } from '../../hooks/useTmuxStream';
import { ansiToHtml } from '../../utils/ansiToHtml';
import { toast } from '../../stores/toastStore';
import Button from '../Button';
import { clsx } from 'clsx';

interface TmuxViewProps {
  /** Optional: filter the session list to a single session (e.g., project workspace). */
  filter?: (s: TmuxSession) => boolean;
  /** Optional: initial selected session name. */
  initialSession?: string;
  /** Optional: hide list, render only the pane viewer. */
  hideList?: boolean;
  className?: string;
}

const CTRL_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'k', 'l', 'n', 'p', 'r', 't', 'u', 'w', 'x', 'y', 'z'];

type DetectedTool = 'claude-code' | 'codex' | 'generic';

/**
 * Best-effort tool detection from the pane's current command and title.
 * Claude Code shows `claude` as the foreground process; Codex CLI shows
 * `codex`. When the pane is wrapped (e.g., `node`, `npx`) we also peek at
 * the pane title which both tools set on startup.
 */
function detectTool(command?: string, title?: string): DetectedTool {
  const c = (command || '').toLowerCase();
  const t = (title || '').toLowerCase();
  const haystack = `${c} ${t}`;
  if (/(^|[\s/])claude(\b|$)/.test(haystack)) return 'claude-code';
  if (/(^|[\s/])codex(\b|$)/.test(haystack)) return 'codex';
  return 'generic';
}

const TOOL_LABEL: Record<DetectedTool, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  generic: 'Shell',
};

export default function TmuxView({ filter, initialSession, hideList, className }: TmuxViewProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(initialSession ?? null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['tmux-sessions'],
    queryFn: tmuxService.listSessions,
    refetchInterval: 5000,
  });

  const visible = useMemo(() => (filter ? sessions.filter(filter) : sessions), [sessions, filter]);

  // Auto-select first session when none picked
  useEffect(() => {
    if (!selected && visible.length > 0) setSelected(visible[0].name);
  }, [visible, selected]);

  const killMutation = useMutation({
    mutationFn: tmuxService.killSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tmux-sessions'] });
      setSelected(null);
      toast.success('Session killed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Kill failed'),
  });

  return (
    <div className={clsx('flex h-full overflow-hidden', className)}>
      {!hideList && (
        <div className="w-72 shrink-0 border-r border-border bg-muted/30 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal size={14} /> Tmux Sessions
              <span className="text-xs text-muted-foreground">({visible.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => refetch()}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="New session"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="animate-spin mr-2" size={14} /> Loading…
              </div>
            ) : visible.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground p-6">
                No tmux sessions on host
              </div>
            ) : (
              <ul className="space-y-0.5 p-1.5">
                {visible.map((s) => (
                  <li key={s.name}>
                    <button
                      onClick={() => setSelected(s.name)}
                      className={clsx(
                        'w-full text-left rounded px-2.5 py-1.5 text-sm flex items-center justify-between gap-2 group',
                        selected === s.name
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-accent text-foreground'
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={clsx(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            s.attached ? 'bg-green-500' : 'bg-zinc-400'
                          )}
                        />
                        <span className="truncate font-mono text-[13px]">{s.name}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {s.windows}w
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {selected ? (
          <PaneViewer
            session={selected}
            onKill={() => killMutation.mutate(selected)}
            killing={killMutation.isPending}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a session to attach
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={(name) => {
            qc.invalidateQueries({ queryKey: ['tmux-sessions'] });
            setSelected(name);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ── Pane Viewer ─────────────────────────────────────────────────

function PaneViewer({
  session,
  onKill,
  killing,
}: {
  session: string;
  onKill: () => void;
  killing: boolean;
}) {
  const [target, setTarget] = useState<{ window?: number; pane?: number }>({});

  // Reset target when switching sessions
  useEffect(() => {
    setTarget({});
  }, [session]);

  const { data: panes = [] } = useQuery({
    queryKey: ['tmux-panes', session],
    queryFn: () => tmuxService.listPanes(session),
    refetchInterval: 5000,
    enabled: !!session,
  });

  const stream = useTmuxStream({ session, window: target.window, pane: target.pane }, 1200);
  const [input, setInput] = useState('');
  const [showCtrl, setShowCtrl] = useState(false);
  const [toolOverride, setToolOverride] = useState<DetectedTool | null>(null);
  const paneRef = useRef<HTMLPreElement>(null);

  // Resolve which pane the viewer is currently watching, then sniff the tool
  // running in it. Manual override (toolOverride) trumps detection.
  const activePane = useMemo<TmuxPane | undefined>(() => {
    if (target.window !== undefined) {
      return panes.find((p) => p.window === target.window && p.pane === (target.pane ?? p.pane));
    }
    return panes.find((p) => p.windowActive && p.paneActive) ?? panes[0];
  }, [panes, target]);
  const detectedTool = useMemo(() => detectTool(activePane?.command, activePane?.title), [activePane]);
  const tool: DetectedTool = toolOverride ?? detectedTool;

  // Reset manual override when the pane changes
  useEffect(() => {
    setToolOverride(null);
  }, [target.window, target.pane, session]);

  // Auto-scroll to bottom on update
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = paneRef.current.scrollHeight;
  }, [stream.text]);

  const send = (tokens: string[], literal = false) => stream.sendKeys(tokens, literal);

  const sendLine = () => {
    if (!input) return;
    send([input], true);
    send(['Enter']);
    setInput('');
  };

  const sendCtrl = (k: string) => send([`C-${k}`]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+<key> while typing in the input → forward to tmux instead of letting
    // the browser steal it.
    if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
      e.preventDefault();
      sendCtrl(e.key.toLowerCase());
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      sendLine();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900 text-zinc-200">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-sm truncate">{session}</span>
          <span
            className={clsx(
              'flex items-center gap-1 text-xs shrink-0',
              stream.connected ? 'text-green-400' : 'text-amber-400'
            )}
          >
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full',
                stream.connected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
              )}
            />
            {stream.connected ? 'live' : 'reconnecting'}
          </span>
          <PaneStrip
            panes={panes}
            current={target}
            onPick={(p) => setTarget({ window: p.window, pane: p.pane })}
            onClear={() => setTarget({})}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={stream.reconnect} title="Reconnect stream">
            <RefreshCw size={13} />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={onKill}
            isLoading={killing}
            title="Kill session"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Pane (capture-pane output, ANSI-colored) */}
      <pre
        ref={paneRef}
        className="flex-1 overflow-y-auto p-3 text-[12.5px] leading-snug font-mono whitespace-pre text-zinc-100"
        dangerouslySetInnerHTML={{
          __html: stream.text
            ? ansiToHtml(stream.text)
            : stream.error
            ? `<span style="color:#e74856">[error] ${stream.error}</span>`
            : '<span style="opacity:0.6">Connecting…</span>',
        }}
      />


      {/* Hotkey toolbar — keyset switches with the detected tool. */}
      <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ToolSwitcher
            detected={detectedTool}
            current={tool}
            override={toolOverride}
            onChange={setToolOverride}
          />
          <ShortcutSet tool={tool} send={send} sendCtrl={sendCtrl} />
          <button
            onClick={() => setShowCtrl((v) => !v)}
            className={clsx(
              'px-2 py-1 text-[11px] rounded font-mono transition-colors ml-auto',
              showCtrl
                ? 'bg-primary text-primary-foreground'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            )}
            title="More keys (full Ctrl palette + arrows + page keys)"
          >
            more
          </button>
        </div>

        {showCtrl && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-800">
            <KeyButton onClick={() => send(['Enter'])} label="Enter" />
            <KeyButton onClick={() => send(['BSpace'])} label="⌫" />
            <KeyButton onClick={() => send(['Left'])} label="←" />
            <KeyButton onClick={() => send(['Right'])} label="→" />
            <KeyButton onClick={() => send(['PageUp'])} label="PgUp" />
            <KeyButton onClick={() => send(['PageDown'])} label="PgDn" />
            <KeyButton onClick={() => send(['Home'])} label="Home" />
            <KeyButton onClick={() => send(['End'])} label="End" />
            <KeyButton onClick={() => sendCtrl('d')} label="⌃D" />
            <KeyButton onClick={() => sendCtrl('z')} label="⌃Z" />
            <span className="mx-1 text-zinc-600 self-center">|</span>
            {CTRL_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => sendCtrl(k)}
                className="px-2 py-0.5 text-[11px] font-mono rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                title={`Ctrl+${k.toUpperCase()}`}
              >
                ⌃{k.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-mono text-xs">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a command, press Enter (Ctrl+letters forwarded to tmux)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-primary"
            autoFocus
          />
          <Button size="sm" onClick={sendLine} disabled={!input}>
            <Send size={12} className="mr-1" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Pane strip (quick-jump buttons in the top bar) ───────────────

function PaneStrip({
  panes,
  current,
  onPick,
  onClear,
}: {
  panes: TmuxPane[];
  current: { window?: number; pane?: number };
  onPick: (p: TmuxPane) => void;
  onClear: () => void;
}) {
  if (!panes || panes.length <= 1) return null;
  const isAuto = current.window === undefined && current.pane === undefined;

  return (
    <div className="flex items-center gap-1 ml-2 overflow-x-auto min-w-0">
      <button
        onClick={onClear}
        title="Active pane (whatever tmux focuses)"
        className={clsx(
          'px-1.5 py-0.5 text-[10px] font-mono rounded shrink-0',
          isAuto ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
        )}
      >
        auto
      </button>
      {panes.map((p) => {
        const active = current.window === p.window && current.pane === p.pane;
        // Label is the window name (first part of what was previously the
        // tooltip); the tooltip now carries the rest (command + title).
        const label = p.windowName || `${p.window}.${p.pane}`;
        const tooltipParts = [
          p.command,
          p.title && p.title !== p.command ? p.title : null,
        ].filter(Boolean);
        const tooltip = tooltipParts.join(' — ') || `${p.window}.${p.pane}`;
        return (
          <button
            key={`${p.window}.${p.pane}`}
            onClick={() => onPick(p)}
            title={tooltip}
            className={clsx(
              'px-1.5 py-0.5 text-[10px] font-mono rounded shrink-0 transition-colors max-w-[14ch] truncate',
              active
                ? 'bg-primary text-primary-foreground'
                : p.paneActive && p.windowActive
                ? 'bg-emerald-700/70 text-white hover:bg-emerald-700'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function KeyButton({
  onClick,
  label,
  tooltip,
  children,
  highlight,
  emphasis,
}: {
  onClick: () => void;
  label: string;
  tooltip?: string;
  children?: ReactNode;
  /** Red — destructive / interrupt. */
  highlight?: boolean;
  /** Primary — frequently-used (e.g., Cycle Modes). */
  emphasis?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2 py-1 text-[11px] rounded font-mono transition-colors flex items-center gap-1',
        emphasis
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 ring-1 ring-primary/40 font-semibold'
          : highlight
          ? 'bg-red-600/80 text-white hover:bg-red-600'
          : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
      )}
      title={tooltip || label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// ── Tool switcher (auto-detects, click to override) ───────────────

function ToolSwitcher({
  detected,
  current,
  override,
  onChange,
}: {
  detected: DetectedTool;
  current: DetectedTool;
  override: DetectedTool | null;
  onChange: (t: DetectedTool | null) => void;
}) {
  const tools: DetectedTool[] = ['claude-code', 'codex', 'generic'];
  return (
    <div
      className="flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-950 p-0.5"
      title={
        override
          ? `Manually set to ${TOOL_LABEL[current]} (detected: ${TOOL_LABEL[detected]})`
          : `Auto-detected: ${TOOL_LABEL[current]}`
      }
    >
      {tools.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t === detected ? null : t)}
          className={clsx(
            'px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors',
            current === t
              ? 'bg-primary text-primary-foreground'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          )}
        >
          {TOOL_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

// ── Shortcut sets per tool ────────────────────────────────────────

function ShortcutSet({
  tool,
  send,
  sendCtrl,
}: {
  tool: DetectedTool;
  send: (tokens: string[], literal?: boolean) => void;
  sendCtrl: (k: string) => void;
}) {
  // Common: Esc + double-Esc + Cycle Modes (emphasized) appear in both AI tools.
  const aiCommon = (
    <>
      <KeyButton
        onClick={() => send(['Escape'])}
        label="Esc"
        tooltip="Interrupt the current generation"
        highlight
      />
      <KeyButton
        onClick={() => send(['Escape', 'Escape'])}
        label="Esc Esc"
        tooltip={
          tool === 'codex'
            ? 'Clear the current input (Codex)'
            : 'Edit previous message (Claude Code)'
        }
      />
      <KeyButton
        onClick={() => send(['BTab'])}
        label="⇧Tab — Cycle Modes"
        tooltip={
          tool === 'codex'
            ? 'Cycle approval mode: ask → edit → agent → full-auto (Codex)'
            : 'Cycle modes: default → auto-accept → plan (Claude Code)'
        }
        emphasis
      />
      <KeyButton onClick={() => send(['Tab'])} label="Tab" tooltip="Autocomplete / file picker" />
      <KeyButton
        onClick={() => sendCtrl('j')}
        label="⌃J ↵"
        tooltip="Insert a newline inside the input (multi-line prompt)"
      />
    </>
  );

  if (tool === 'claude-code') {
    return (
      <>
        {aiCommon}
        <KeyButton onClick={() => sendCtrl('r')} label="⌃R" tooltip="Toggle verbose output" />
        <KeyButton onClick={() => sendCtrl('t')} label="⌃T" tooltip="Show TODOs / task list" />
        <KeyButton onClick={() => sendCtrl('o')} label="⌃O" tooltip="Open last response in pager" />
        <KeyButton onClick={() => send(['C-_'])} label="⌃_" tooltip="Undo last file edit" />
        <KeyButton onClick={() => sendCtrl('l')} label="⌃L" tooltip="Clear screen" />
        <span className="mx-1 text-zinc-600">|</span>
        <KeyButton onClick={() => send(['Up'])} label="↑" tooltip="History prev" />
        <KeyButton onClick={() => send(['Down'])} label="↓" tooltip="History next" />
        <KeyButton onClick={() => sendCtrl('c')} label="⌃C" tooltip="Cancel / SIGINT" highlight />
      </>
    );
  }

  if (tool === 'codex') {
    return (
      <>
        {aiCommon}
        <KeyButton onClick={() => sendCtrl('t')} label="⌃T" tooltip="Show transcript (Codex)" />
        <KeyButton onClick={() => sendCtrl('r')} label="⌃R" tooltip="Reload / verbose" />
        <KeyButton onClick={() => sendCtrl('l')} label="⌃L" tooltip="Clear screen" />
        <span className="mx-1 text-zinc-600">|</span>
        <KeyButton onClick={() => send(['Up'])} label="↑" tooltip="History prev" />
        <KeyButton onClick={() => send(['Down'])} label="↓" tooltip="History next" />
        <KeyButton onClick={() => sendCtrl('c')} label="⌃C" tooltip="Cancel / SIGINT" highlight />
      </>
    );
  }

  // Generic shell / unknown
  return (
    <>
      <KeyButton onClick={() => send(['Enter'])} label="↵" tooltip="Enter" />
      <KeyButton onClick={() => send(['Tab'])} label="Tab" tooltip="Tab" />
      <KeyButton onClick={() => send(['Escape'])} label="Esc" tooltip="Escape" />
      <KeyButton onClick={() => send(['Up'])} label="↑" tooltip="History prev" />
      <KeyButton onClick={() => send(['Down'])} label="↓" tooltip="History next" />
      <KeyButton onClick={() => sendCtrl('r')} label="⌃R" tooltip="Reverse history search" />
      <KeyButton onClick={() => sendCtrl('l')} label="⌃L" tooltip="Clear screen" />
      <KeyButton onClick={() => sendCtrl('a')} label="⌃A" tooltip="Beginning of line" />
      <KeyButton onClick={() => sendCtrl('e')} label="⌃E" tooltip="End of line" />
      <KeyButton onClick={() => sendCtrl('u')} label="⌃U" tooltip="Clear line" />
      <KeyButton onClick={() => sendCtrl('w')} label="⌃W" tooltip="Delete prev word" />
      <KeyButton onClick={() => sendCtrl('c')} label="⌃C" tooltip="Cancel / SIGINT" highlight />
      <KeyButton onClick={() => sendCtrl('d')} label="⌃D" tooltip="EOF / exit" />
      <KeyButton onClick={() => sendCtrl('z')} label="⌃Z" tooltip="Suspend (SIGTSTP)" />
    </>
  );
}

// ── Create session modal ────────────────────────────────────────

function CreateSessionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const create = useMutation({
    mutationFn: (vars: { name: string; cwd?: string }) => tmuxService.newSession(vars.name, { cwd: vars.cwd }),
    onSuccess: () => onCreated(name),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">New Tmux Session</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9._-]/g, '-'))}
              placeholder="e.g., my-session"
              className="w-full px-3 py-2 text-sm border border-border rounded bg-background font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Working dir (optional)</label>
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="/home/app/…"
              className="w-full px-3 py-2 text-sm border border-border rounded bg-background font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => create.mutate({ name, cwd: cwd || undefined })}
              isLoading={create.isPending}
              disabled={!name}
              className="flex-1"
            >
              Create
            </Button>
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
