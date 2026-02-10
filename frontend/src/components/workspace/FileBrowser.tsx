/**
 * FileBrowser Component
 * Recursive file tree browser with search, expand/collapse, and file selection.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  FileType,
  File,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../services/api';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
}

interface FileBrowserProps {
  projectId: string;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'cs':
    case 'php':
    case 'swift':
    case 'kt':
    case 'sh':
    case 'bash':
    case 'zsh':
      return FileCode;
    case 'json':
    case 'jsonc':
      return FileJson;
    case 'md':
    case 'mdx':
    case 'txt':
    case 'rst':
    case 'log':
      return FileText;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
    case 'html':
    case 'htm':
    case 'xml':
    case 'svg':
    case 'yaml':
    case 'yml':
    case 'toml':
      return FileType;
    default:
      return File;
  }
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query) return nodes;

  const lowerQuery = query.toLowerCase();
  const result: FileNode[] = [];

  for (const node of nodes) {
    if (node.type === 'folder' && node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    } else if (node.name.toLowerCase().includes(lowerQuery)) {
      result.push(node);
    }
  }

  return result;
}

function collectAllFolderPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path);
      if (node.children) {
        paths.push(...collectAllFolderPaths(node.children));
      }
    }
  }
  return paths;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (path: string) => void;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggleExpand,
  onFileSelect,
  selectedFile,
}: TreeNodeProps) {
  const isDir = node.type === 'folder';
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedFile === node.path;
  const paddingLeft = depth * 16 + 12;

  const handleClick = () => {
    if (isDir) {
      onToggleExpand(node.path);
    } else {
      onFileSelect(node.path);
    }
  };

  const Icon = isDir
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(node.name);

  return (
    <>
      <button
        onClick={handleClick}
        className={clsx(
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground font-medium',
          !isSelected && 'text-card-foreground'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        title={node.path}
      >
        {isDir && (
          <span className="shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        )}
        {!isDir && <span className="w-3.5 shrink-0" />}
        <Icon
          className={clsx(
            'h-4 w-4 shrink-0',
            isDir ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
      <div className={clsx('h-3 animate-pulse rounded bg-muted', width)} />
    </div>
  );
}

export default function FileBrowser({
  projectId,
  onFileSelect,
  selectedFile,
}: FileBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const {
    data: fileTree,
    isLoading,
    isError,
    error,
  } = useQuery<FileNode[]>({
    queryKey: ['file-tree', projectId],
    queryFn: async () => {
      const response = await api.get<{ data: FileNode[] }>(
        `/api/v1/files/projects/${projectId}/tree`
      );
      return response.data.data;
    },
    enabled: !!projectId,
  });

  const handleToggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const filteredTree = useMemo(() => {
    if (!fileTree) return [];
    const filtered = filterTree(fileTree, searchQuery);
    if (searchQuery && filtered.length > 0) {
      const allFolders = collectAllFolderPaths(filtered);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const folder of allFolders) {
          next.add(folder);
        }
        return next;
      });
    }
    return filtered;
  }, [fileTree, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0.5 p-2">
        <SkeletonLine width="w-24" />
        <SkeletonLine width="w-32" />
        <SkeletonLine width="w-20" />
        <SkeletonLine width="w-28" />
        <SkeletonLine width="w-36" />
        <SkeletonLine width="w-16" />
        <SkeletonLine width="w-24" />
        <SkeletonLine width="w-32" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load file tree: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto p-1">
        {filteredTree.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {searchQuery ? 'No files match your search' : 'No files found'}
          </div>
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggleExpand={handleToggleExpand}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
