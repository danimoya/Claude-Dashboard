/**
 * TerminalPanel
 *
 * Bottom-of-workspace tabbed terminal. Two flavours:
 *   - Tmux: live host pane for the project's slug-named session (auto-created
 *     on project creation; we attach if present, otherwise offer to create).
 *   - Claude-B: list of cb sessions filtered by working dir + ad-hoc CLI
 *     sessions tied to this project.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  Plus,
  RefreshCw,
} from 'lucide-react';
import CLITerminal from '../cli/CLITerminal';
import TmuxView from '../cli/TmuxView';
import { cliService, type CreateSessionDto } from '../../services/cli.service';
import { tmuxService } from '../../services/tmuxService';
import { projectService } from '../../services/projectService';
import { claudeBService } from '../../services/claudeBService';
import Button from '../Button';
import { toast } from '../../stores/toastStore';
import type { ProjectType } from '@shared/types';

interface TerminalPanelProps {
  projectId: string;
}

type TabId = 'tmux' | 'claude-b' | 'cli';

interface CLISession {
  id: string;
  projectId: string;
  type: ProjectType;
  status: string;
  command: string;
  args?: string[];
  startedAt: string;
}

export default function TerminalPanel({ projectId }: TerminalPanelProps) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<TabId>('tmux');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newType, setNewType] = useState<ProjectType>('claude-code');
  const [newCommand, setNewCommand] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
  });

  const projectSlug: string | null = useMemo(() => {
    const m = project?.metadata as any;
    return (m?.tmuxSession as string) || null;
  }, [project]);

  // Auto-attach tmux session if present
  const ensureTmuxMutation = useMutation({
    mutationFn: async () => {
      if (!projectSlug || !project) return;
      // Try to create — backend is idempotent enough (we silently log on fail);
      // here we only create if it doesn't already exist server-side.
      try {
        await tmuxService.newSession(projectSlug, { cwd: project.path });
      } catch {
        // Already exists or tmux unavailable — fine, TmuxView surfaces both
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tmux-sessions'] });
    },
  });

  // CLI sessions tied to this project (DB-tracked)
  const { data: cliSessions } = useQuery<CLISession[]>({
    queryKey: ['cli-sessions', projectId],
    queryFn: () => cliService.getProjectSessions(projectId),
    refetchInterval: 5000,
    enabled: !!projectId,
  });

  // Claude-B sessions whose workingDir matches the project path
  const { data: cbSessionsResp } = useQuery({
    queryKey: ['cb-sessions'],
    queryFn: claudeBService.listSessions,
    refetchInterval: 5000,
  });
  const cbSessions = (cbSessionsResp?.sessions ?? []).filter((s: any) => {
    if (!project?.path || !s.workingDir) return false;
    return s.workingDir === project.path || s.workingDir.startsWith(project.path);
  });

  const createCli = useMutation({
    mutationFn: (data: CreateSessionDto) => cliService.createSession(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cli-sessions', projectId] });
      setActiveSessionId(data.session.id);
      setShowCreateForm(false);
      setNewCommand('');
      toast.success('Session created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed'),
  });

  return (
    <div className={clsx('flex flex-col border-t border-border bg-card', collapsed ? 'h-10' : 'h-80')}>
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1">
          <Terminal className="h-4 w-4 text-muted-foreground mr-1" />
          {(['tmux', 'claude-b', 'cli'] as TabId[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'px-2.5 py-0.5 rounded text-xs font-medium transition-colors',
                tab === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {id === 'tmux' ? 'Tmux' : id === 'claude-b' ? `Claude-B (${cbSessions.length})` : `CLI (${cliSessions?.length ?? 0})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {!collapsed && tab === 'tmux' && projectSlug && (
            <button
              onClick={() => ensureTmuxMutation.mutate()}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              title="Ensure tmux session exists"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {!collapsed && tab === 'cli' && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              title="New CLI session"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {tab === 'tmux' ? (
            projectSlug ? (
              <TmuxView
                hideList
                initialSession={projectSlug}
                className="h-full"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                <p>This project has no tmux session yet.</p>
                <Button
                  size="sm"
                  onClick={() => ensureTmuxMutation.mutate()}
                  isLoading={ensureTmuxMutation.isPending}
                >
                  <Plus size={14} className="mr-1" /> Create
                </Button>
              </div>
            )
          ) : tab === 'claude-b' ? (
            <CBSessionsPanel sessions={cbSessions} />
          ) : (
            <CLITabPanel
              sessions={cliSessions ?? []}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
              showCreateForm={showCreateForm}
              setShowCreateForm={setShowCreateForm}
              newType={newType}
              setNewType={setNewType}
              newCommand={newCommand}
              setNewCommand={setNewCommand}
              createCli={createCli}
              projectId={projectId}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Claude-B sessions panel ─────────────────────────────────────

function CBSessionsPanel({ sessions }: { sessions: any[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && sessions.length > 0) setSelected(sessions[0].id);
  }, [sessions, selected]);

  if (sessions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        No Claude-B sessions tied to this project's working directory
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-muted/40">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={clsx(
              'w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 border-b border-border',
              selected === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
            )}
          >
            <span className="font-mono">{s.name || s.id}</span>
            <span className="text-[10px] text-muted-foreground">
              {s.status} · {s.promptCount ?? 0} prompts
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {selected && <CBOutput sessionId={selected} />}
      </div>
    </div>
  );
}

function CBOutput({ sessionId }: { sessionId: string }) {
  // Use the transcript endpoint so we render the FULL session, not just last line.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cb-transcript', sessionId],
    queryFn: () => claudeBService.getTranscript(sessionId),
    refetchInterval: 4000,
  });

  const transcript: string =
    typeof data === 'string'
      ? data
      : typeof (data as any)?.transcript === 'string'
      ? (data as any).transcript
      : JSON.stringify(data, null, 2);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30 text-xs">
        <span className="font-mono">{sessionId}</span>
        <button onClick={() => refetch()} className="p-1 hover:bg-accent rounded" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>
      <pre className="flex-1 overflow-y-auto p-3 text-xs font-mono whitespace-pre-wrap bg-zinc-950 text-zinc-200">
        {isLoading ? 'Loading transcript…' : transcript || '(empty)'}
      </pre>
    </div>
  );
}

// ── CLI tab (existing flow, lightly tidied) ─────────────────────

function CLITabPanel(props: {
  sessions: CLISession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string) => void;
  showCreateForm: boolean;
  setShowCreateForm: (b: boolean) => void;
  newType: ProjectType;
  setNewType: (t: ProjectType) => void;
  newCommand: string;
  setNewCommand: (s: string) => void;
  createCli: ReturnType<typeof useMutation<any, any, CreateSessionDto>>;
  projectId: string;
}) {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    showCreateForm,
    setShowCreateForm,
    newType,
    setNewType,
    newCommand,
    setNewCommand,
    createCli,
    projectId,
  } = props;

  const handleCreate = () => {
    if (!newCommand.trim()) return;
    createCli.mutate({ projectId, type: newType, command: newCommand.trim() });
  };

  return (
    <div className="flex h-full">
      {sessions.length > 0 && (
        <div className="w-40 shrink-0 overflow-y-auto border-r border-border bg-muted/50">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={clsx(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs',
                activeSessionId === s.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <span
                className={clsx(
                  'h-2 w-2 shrink-0 rounded-full',
                  s.status === 'running' && 'bg-green-500',
                  s.status === 'stopped' && 'bg-gray-500',
                  s.status === 'error' && 'bg-red-500'
                )}
              />
              <span className="truncate">{s.command}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {showCreateForm ? (
          <div className="flex h-full items-start justify-center p-4">
            <div className="w-full max-w-sm space-y-3">
              <h3 className="text-sm font-medium">New CLI Session</h3>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ProjectType)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="claude-b">Claude-B</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Command</label>
                <input
                  type="text"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="e.g., chat"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleCreate} isLoading={createCli.isPending}>
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : activeSessionId ? (
          <CLITerminal sessionId={activeSessionId} className="h-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <Terminal className="h-6 w-6" />
            <p>No active CLI session</p>
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Create
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
