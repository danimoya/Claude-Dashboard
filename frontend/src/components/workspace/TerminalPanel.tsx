/**
 * TerminalPanel Component
 * Wrapper around CLITerminal with session management, collapse/expand, and new session creation.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Terminal,
  Loader2,
  X,
} from 'lucide-react';
import CLITerminal from '../cli/CLITerminal';
import { cliService, type CreateSessionDto } from '../../services/cli.service';
import type { ProjectType } from '@shared/types';

interface TerminalPanelProps {
  projectId: string;
}

interface CLISession {
  id: string;
  projectId: string;
  type: ProjectType;
  status: string;
  command: string;
  args?: string[];
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export default function TerminalPanel({ projectId }: TerminalPanelProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newType, setNewType] = useState<ProjectType>('claude-code');
  const [newCommand, setNewCommand] = useState('');

  const {
    data: sessions,
  } = useQuery<CLISession[]>({
    queryKey: ['cli-sessions', projectId],
    queryFn: () => cliService.getProjectSessions(projectId),
    refetchInterval: 5000,
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSessionDto) => cliService.createSession(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cli-sessions', projectId] });
      setActiveSessionId(data.session.id);
      setShowCreateForm(false);
      setNewCommand('');
      setNewType('claude-code');
    },
  });

  const handleCreateSession = useCallback(() => {
    if (!newCommand.trim()) return;

    createMutation.mutate({
      projectId,
      type: newType,
      command: newCommand.trim(),
    });
  }, [projectId, newType, newCommand, createMutation]);

  const handleCancelCreate = useCallback(() => {
    setShowCreateForm(false);
    setNewCommand('');
    setNewType('claude-code');
  }, []);

  const activeSessions = sessions?.filter((s) => s.status === 'running') ?? [];
  const hasActiveSession = activeSessionId !== null;

  return (
    <div
      className={clsx(
        'flex flex-col border-t border-border bg-card',
        collapsed ? 'h-10' : 'h-80'
      )}
    >
      {/* Header bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-card-foreground">Terminal</span>

          {activeSessions.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeSessions.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!collapsed && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="New session"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title={collapsed ? 'Expand terminal' : 'Collapse terminal'}
          >
            {collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content (hidden when collapsed) */}
      {!collapsed && (
        <div className="flex flex-1 overflow-hidden">
          {/* Session tabs */}
          {sessions && sessions.length > 0 && (
            <div className="w-40 shrink-0 overflow-y-auto border-r border-border bg-muted/50">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                    activeSessionId === session.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                  )}
                  title={`${session.command} (${session.status})`}
                >
                  <span
                    className={clsx(
                      'h-2 w-2 shrink-0 rounded-full',
                      session.status === 'running' && 'bg-green-500',
                      session.status === 'stopped' && 'bg-gray-500',
                      session.status === 'error' && 'bg-red-500',
                      session.status !== 'running' &&
                        session.status !== 'stopped' &&
                        session.status !== 'error' &&
                        'bg-yellow-500'
                    )}
                  />
                  <span className="truncate">{session.command}</span>
                </button>
              ))}
            </div>
          )}

          {/* Terminal / empty state / create form */}
          <div className="flex-1 overflow-hidden">
            {showCreateForm ? (
              <div className="flex h-full items-start justify-center p-4">
                <div className="w-full max-w-sm space-y-3">
                  <h3 className="text-sm font-medium text-card-foreground">
                    New Session
                  </h3>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as ProjectType)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="claude-code">Claude Code</option>
                      <option value="claude-b">Claude-B</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Command
                    </label>
                    <input
                      type="text"
                      value={newCommand}
                      onChange={(e) => setNewCommand(e.target.value)}
                      placeholder="e.g., chat"
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSession();
                        if (e.key === 'Escape') handleCancelCreate();
                      }}
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateSession}
                      disabled={!newCommand.trim() || createMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Create
                    </button>
                    <button
                      onClick={handleCancelCreate}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>

                  {createMutation.isError && (
                    <p className="text-xs text-destructive">
                      Failed to create session:{' '}
                      {createMutation.error instanceof Error
                        ? createMutation.error.message
                        : 'Unknown error'}
                    </p>
                  )}
                </div>
              </div>
            ) : hasActiveSession ? (
              <CLITerminal sessionId={activeSessionId} className="h-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <Terminal className="mb-2 h-8 w-8" />
                <p className="text-sm">No active session</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Session
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
