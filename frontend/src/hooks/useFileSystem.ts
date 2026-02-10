/**
 * File System React Query Hooks
 * Wraps fileService with caching and mutation helpers.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService, type FileTreeNode } from '../services/fileService';

export function useFileTree(projectId: string | undefined) {
  return useQuery<FileTreeNode[]>({
    queryKey: ['fileTree', projectId],
    queryFn: () => fileService.getFileTree(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useFileContent(projectId: string | undefined, filePath: string | undefined) {
  return useQuery<string>({
    queryKey: ['fileContent', projectId, filePath],
    queryFn: () => fileService.readFile(projectId!, filePath!),
    enabled: !!projectId && !!filePath,
    staleTime: 10_000,
  });
}

export function useWriteFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filePath, content }: { filePath: string; content: string }) =>
      fileService.writeFile(projectId, filePath, content),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fileContent', projectId, vars.filePath] });
    },
  });
}

export function useCreateFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filePath, type }: { filePath: string; type: 'file' | 'directory' }) =>
      fileService.createFile(projectId, filePath, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileTree', projectId] });
    },
  });
}

export function useDeleteFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filePath: string) => fileService.deleteFile(projectId, filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileTree', projectId] });
    },
  });
}

export function useRenameFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      fileService.renameFile(projectId, oldPath, newPath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileTree', projectId] });
    },
  });
}
