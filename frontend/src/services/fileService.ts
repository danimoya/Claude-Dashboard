/**
 * File System API Service
 */

import { api } from './api';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
}

export const fileService = {
  async getFileTree(projectId: string): Promise<FileTreeNode[]> {
    const response = await api.get(`/api/v1/files/projects/${projectId}/tree`);
    return response.data.data;
  },

  async readFile(projectId: string, filePath: string): Promise<string> {
    const response = await api.get(`/api/v1/files/projects/${projectId}/read`, {
      params: { path: filePath },
    });
    return response.data.data.content;
  },

  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    await api.put(`/api/v1/files/projects/${projectId}/write`, { path: filePath, content });
  },

  async createFile(projectId: string, filePath: string, type: 'file' | 'directory'): Promise<void> {
    await api.post(`/api/v1/files/projects/${projectId}/create`, { path: filePath, type });
  },

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    await api.delete(`/api/v1/files/projects/${projectId}/delete`, {
      params: { path: filePath },
    });
  },

  async renameFile(projectId: string, oldPath: string, newPath: string): Promise<void> {
    await api.patch(`/api/v1/files/projects/${projectId}/rename`, { oldPath, newPath });
  },
};
