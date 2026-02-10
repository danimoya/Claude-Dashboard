/**
 * CodeEditor Component
 * Monaco-based code editor with auto-save, language detection, and theme integration.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Editor, { type OnMount } from '@monaco-editor/react';
import { FileCode, Loader2, Check } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { api } from '../../services/api';

interface CodeEditorProps {
  projectId: string;
  filePath: string | null;
  onSave?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    jsonc: 'json',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    txt: 'plaintext',
    log: 'plaintext',
    env: 'ini',
    ini: 'ini',
    conf: 'ini',
  };

  return languageMap[ext || ''] || 'plaintext';
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export default function CodeEditor({ projectId, filePath, onSave }: CodeEditorProps) {
  const { theme } = useThemeStore();
  const [content, setContent] = useState<string>('');
  const [isModified, setIsModified] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const {
    data: fileContent,
    isLoading,
    isError,
    error,
  } = useQuery<string>({
    queryKey: ['file-content', projectId, filePath],
    queryFn: async () => {
      const response = await api.get<{ data: { content: string } }>(
        `/api/v1/files/projects/${projectId}/read`,
        { params: { path: filePath } }
      );
      return response.data.data.content;
    },
    enabled: !!projectId && !!filePath,
  });

  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      await api.put(`/api/v1/files/projects/${projectId}/write`, {
        path: filePath,
        content: newContent,
      });
    },
    onMutate: () => {
      setSaveStatus('saving');
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setIsModified(false);
      onSave?.();
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    },
    onError: () => {
      setSaveStatus('idle');
    },
  });

  // Sync fetched content into editor state
  useEffect(() => {
    if (fileContent !== undefined) {
      setContent(fileContent);
      setIsModified(false);
      setSaveStatus('idle');
    }
  }, [fileContent]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newValue = value ?? '';
      setContent(newValue);
      setIsModified(true);
      setSaveStatus('idle');

      // Debounced auto-save
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate(newValue);
      }, 1500);
    },
    [saveMutation]
  );

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  // Empty state: no file selected
  if (!filePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-muted-foreground">
        <FileCode className="mb-3 h-12 w-12" />
        <p className="text-lg font-medium">Select a file to edit</p>
        <p className="mt-1 text-sm">Choose a file from the file browser to get started</p>
      </div>
    );
  }

  const language = getLanguageFromPath(filePath);
  const fileName = getFileName(filePath);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3">
        <div className="flex items-center gap-2 py-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-card-foreground">
            {fileName}
          </span>
          {isModified && (
            <span className="h-2 w-2 rounded-full bg-primary" title="Unsaved changes" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-green-500">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">
            Failed to load file: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            theme={monacoTheme}
            value={content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
            }}
            loading={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
