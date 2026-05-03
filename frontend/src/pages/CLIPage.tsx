/**
 * Sessions Page
 *
 * Live host tmux sessions: pick a session, attach, stream the pane, send
 * keys (Claude Code / Codex / shell keysets). The previous DB-tracked CLI
 * tab moved to its own /claude-b route.
 */

import TmuxView from '../components/cli/TmuxView';

export default function CLIPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-3">
        <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Host tmux sessions — attach, stream live, send keys.
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <TmuxView className="h-full" />
      </div>
    </div>
  );
}
