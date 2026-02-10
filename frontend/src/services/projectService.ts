/**
 * Project API Service
 */

import { api } from './api';
import { ROUTES } from '@shared/constants';
import type { Project } from '@shared/types';
import type { CreateProjectDto, UpdateProjectDto } from '@shared/schemas';

export const projectService = {
  /**
   * Get all user projects
   */
  async getProjects(): Promise<Project[]> {
    const response = await api.get(ROUTES.PROJECTS.BASE);
    return response.data.data;
  },

  /**
   * Get a single project
   */
  async getProject(id: string): Promise<Project> {
    const response = await api.get(ROUTES.PROJECTS.BY_ID(id));
    return response.data.data;
  },

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectDto): Promise<Project> {
    const response = await api.post(ROUTES.PROJECTS.BASE, data);
    return response.data.data;
  },

  /**
   * Update a project
   */
  async updateProject(id: string, data: UpdateProjectDto): Promise<Project> {
    const response = await api.patch(ROUTES.PROJECTS.BY_ID(id), data);
    return response.data.data;
  },

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    await api.delete(ROUTES.PROJECTS.BY_ID(id));
  },

  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    byType: Record<string, number>;
  }> {
    const response = await api.get(`${ROUTES.PROJECTS.BASE}/stats`);
    return response.data.data;
  },
};
