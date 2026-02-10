/**
 * CLI Page
 * Main page for CLI session management
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cliService } from '../services/cli.service';
import SessionList from '../components/cli/SessionList';
import CLITerminal from '../components/cli/CLITerminal';
import Button from '../components/Button';
import type { CLISession, ProjectType } from '@shared/types';

export default function CLIPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<CLISession | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newSession, setNewSession] = useState({
    type: 'claude-code' as ProjectType,
    command: '',
    args: [] as string[],
  });

  const createSessionMutation = useMutation({
    mutationFn: cliService.createSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cli-sessions'] });
      setSelectedSession(data.session);
      setShowCreateModal(false);
      setNewSession({ type: 'claude-code', command: '', args: [] });
    },
  });

  const handleCreateSession = () => {
    if (!projectId || !newSession.command) return;

    createSessionMutation.mutate({
      projectId,
      type: newSession.type,
      command: newSession.command,
      args: newSession.args.filter((arg) => arg.trim()),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">CLI Sessions</h1>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            New Session
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Session List Sidebar */}
        <div className="w-96 border-r border-border bg-muted/30 overflow-y-auto p-4">
          <SessionList
            projectId={projectId}
            onSelectSession={setSelectedSession}
            selectedSessionId={selectedSession?.id}
          />
        </div>

        {/* Terminal */}
        <div className="flex-1 overflow-hidden">
          {selectedSession ? (
            <CLITerminal sessionId={selectedSession.id} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-lg">Select a session to view output</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card text-card-foreground rounded-lg shadow-xl p-6 w-full max-w-md border border-border">
            <h2 className="text-xl font-bold mb-4">Create New Session</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Type
                </label>
                <select
                  value={newSession.type}
                  onChange={(e) =>
                    setNewSession({ ...newSession, type: e.target.value as ProjectType })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="claude-flow">Claude Flow</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Command
                </label>
                <input
                  type="text"
                  value={newSession.command}
                  onChange={(e) => setNewSession({ ...newSession, command: e.target.value })}
                  placeholder="e.g., chat"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Arguments (optional)
                </label>
                <input
                  type="text"
                  value={newSession.args.join(' ')}
                  onChange={(e) =>
                    setNewSession({ ...newSession, args: e.target.value.split(' ') })
                  }
                  placeholder="e.g., --verbose --debug"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>
            </div>

            {createSessionMutation.isError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  {(createSessionMutation.error as any)?.response?.data?.error || 'Failed to create session'}
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                onClick={handleCreateSession}
                disabled={!newSession.command}
                isLoading={createSessionMutation.isPending}
                className="flex-1"
              >
                Create
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
