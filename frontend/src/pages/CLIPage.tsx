/**
 * CLI Page
 *
 * Tabbed view: Tmux (host sessions, primary) and CLI (DB-tracked claude/cb
 * sessions). Tmux side lists all host sessions and lets the operator attach,
 * stream the pane live, and send keys (including Ctrl+<letter> hotkeys).
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cliService } from '../services/cli.service';
import { projectService } from '../services/projectService';
import SessionList from '../components/cli/SessionList';
import CLITerminal from '../components/cli/CLITerminal';
import TmuxView from '../components/cli/TmuxView';
import Tabs from '../components/Tabs';
import Button from '../components/Button';
import { toast } from '../stores/toastStore';
import type { CLISession, ProjectType } from '@shared/types';

export default function CLIPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const [tab, setTab] = useState<'tmux' | 'cli'>('tmux');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Terminals</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Host tmux sessions and tracked CLI sessions
          </p>
        </div>
      </div>

      <div className="px-6 pt-3 border-b border-border">
        <Tabs
          tabs={[
            { id: 'tmux', label: 'Tmux' },
            { id: 'cli', label: 'CLI' },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as 'tmux' | 'cli')}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'tmux' ? <TmuxView className="h-full" /> : <CLITab routeProjectId={routeProjectId} />}
      </div>
    </div>
  );
}

// ── CLI Tab (preserved from old CLIPage) ────────────────────────

function CLITab({ routeProjectId }: { routeProjectId?: string }) {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<CLISession | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newSession, setNewSession] = useState({
    projectId: routeProjectId || '',
    type: 'claude-code' as ProjectType,
    command: '',
    args: [] as string[],
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getProjects,
    enabled: !routeProjectId,
  });

  const activeProjectId = routeProjectId || newSession.projectId || undefined;

  const createSessionMutation = useMutation({
    mutationFn: cliService.createSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cli-sessions'] });
      setSelectedSession(data.session);
      setShowCreateModal(false);
      setNewSession((prev) => ({ ...prev, command: '', args: [] }));
      toast.success('CLI session created');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create session');
    },
  });

  const handleCreateSession = () => {
    const pid = routeProjectId || newSession.projectId;
    if (!pid || !newSession.command) return;
    createSessionMutation.mutate({
      projectId: pid,
      type: newSession.type,
      command: newSession.command,
      args: newSession.args.filter((arg) => arg.trim()),
    });
  };

  return (
    <div className="flex h-full">
      <div className="w-96 border-r border-border bg-muted/30 overflow-y-auto p-4">
        <div className="mb-3">
          <Button onClick={() => setShowCreateModal(true)} size="sm" className="w-full">
            New CLI Session
          </Button>
        </div>
        <SessionList
          projectId={activeProjectId}
          onSelectSession={setSelectedSession}
          selectedSessionId={selectedSession?.id}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {selectedSession ? (
          <CLITerminal sessionId={selectedSession.id} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Select a session to view output
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground rounded-lg shadow-xl p-6 w-full max-w-md border border-border">
            <h2 className="text-xl font-bold mb-4">Create New Session</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSession();
              }}
              className="space-y-4"
            >
              {!routeProjectId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Project</label>
                  <select
                    value={newSession.projectId}
                    onChange={(e) => setNewSession({ ...newSession, projectId: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    required
                  >
                    <option value="">Select a project...</option>
                    {projects?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newSession.type}
                  onChange={(e) =>
                    setNewSession({ ...newSession, type: e.target.value as ProjectType })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="claude-b">Claude-B</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Command</label>
                <input
                  type="text"
                  value={newSession.command}
                  onChange={(e) => setNewSession({ ...newSession, command: e.target.value })}
                  placeholder="e.g., chat"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Arguments (optional)</label>
                <input
                  type="text"
                  value={newSession.args.join(' ')}
                  onChange={(e) =>
                    setNewSession({ ...newSession, args: e.target.value.split(' ') })
                  }
                  placeholder="e.g., --verbose"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={!newSession.command || (!routeProjectId && !newSession.projectId)}
                  isLoading={createSessionMutation.isPending}
                  className="flex-1"
                >
                  Create
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
