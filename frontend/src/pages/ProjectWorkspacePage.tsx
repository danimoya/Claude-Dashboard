/**
 * Project Workspace Page
 * Three-panel IDE-like layout: file browser, code editor, terminal
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import FileBrowser from '../components/workspace/FileBrowser';
import CodeEditor from '../components/workspace/CodeEditor';
import TerminalPanel from '../components/workspace/TerminalPanel';
import { PanelLeftClose, PanelLeft, PanelBottomClose, PanelBottom } from 'lucide-react';

export default function ProjectWorkspacePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId!),
    enabled: !!projectId,
  });

  if (!projectId) {
    navigate('/dashboard');
    return null;
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <button onClick={() => navigate('/dashboard')} className="text-primary hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            title={sidebarOpen ? 'Hide file browser' : 'Show file browser'}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
          <div>
            <h2 className="text-sm font-semibold">{project.name}</h2>
            <p className="text-xs text-muted-foreground">{project.type}</p>
          </div>
        </div>
        <button
          onClick={() => setTerminalOpen(!terminalOpen)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          title={terminalOpen ? 'Hide terminal' : 'Show terminal'}
        >
          {terminalOpen ? <PanelBottomClose size={18} /> : <PanelBottom size={18} />}
        </button>
      </div>

      {/* Main workspace area */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Browser */}
        {sidebarOpen && (
          <div className="w-64 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
            <FileBrowser
              projectId={projectId}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile ?? undefined}
            />
          </div>
        )}

        {/* Editor + Terminal */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Code Editor */}
          <div className={`flex-1 min-h-0 ${!terminalOpen ? 'h-full' : ''}`}>
            <CodeEditor
              projectId={projectId}
              filePath={selectedFile}
            />
          </div>

          {/* Terminal */}
          {terminalOpen && (
            <div className="h-72 flex-shrink-0 border-t border-border">
              <TerminalPanel projectId={projectId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
