/**
 * Session List Component
 * Display and manage CLI sessions
 */

import { useQuery } from '@tanstack/react-query';
import { cliService } from '../../services/cli.service';
import type { CLISession } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';

interface SessionListProps {
  projectId?: string;
  onSelectSession?: (session: CLISession) => void;
  selectedSessionId?: string;
}

export default function SessionList({
  projectId,
  onSelectSession,
  selectedSessionId,
}: SessionListProps) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['cli-sessions', projectId],
    queryFn: () =>
      projectId
        ? cliService.getProjectSessions(projectId)
        : cliService.getActiveSessions(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Running';
      case 'stopped':
        return 'Stopped';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        No sessions found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => onSelectSession?.(session)}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            selectedSessionId === session.id
              ? 'bg-blue-50 border-blue-300'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(session.status)}`} />
                <span className="font-medium text-gray-900">
                  {session.command}
                </span>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                  {session.type}
                </span>
              </div>

              {session.args && session.args.length > 0 && (
                <div className="mt-1 text-sm text-gray-500 font-mono">
                  {session.args.join(' ')}
                </div>
              )}

              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                <span>
                  Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                </span>
                {session.endedAt && (
                  <span>
                    Ended {formatDistanceToNow(new Date(session.endedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>

            <div className="ml-4">
              <span
                className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  session.status === 'running'
                    ? 'bg-green-100 text-green-800'
                    : session.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {getStatusText(session.status)}
              </span>
            </div>
          </div>

          {session.metadata && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {session.metadata.totalCommands !== undefined && (
                  <span>Commands: {session.metadata.totalCommands}</span>
                )}
                {session.metadata.errors !== undefined && (
                  <span className="text-red-500">Errors: {session.metadata.errors}</span>
                )}
                {session.metadata.lastCommand && (
                  <span className="font-mono truncate max-w-xs">
                    Last: {session.metadata.lastCommand}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
