/**
 * Project Service
 * Handles project CRUD operations
 */

import { AppDataSource } from '../config/database.js';
import { Project } from '../entities/Project.entity.js';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/env.js';
import type { CreateProjectDto, UpdateProjectDto } from '@shared/schemas';
import path from 'path';
import { mkdir, stat } from 'fs/promises';

export class ProjectService {
  private projectRepository = AppDataSource.getRepository(Project);
  private projectsBasePath = config.projectsBasePath;

  /**
   * Create a new project
   */
  async createProject(userId: string, dto: CreateProjectDto): Promise<Project> {
    let projectPath: string;

    if (dto.path) {
      // User-provided path — resolve relative to base and validate
      const resolved = path.resolve(this.projectsBasePath, dto.path);
      if (!resolved.startsWith(this.projectsBasePath)) {
        throw AppError.badRequest('Invalid project path: directory traversal not allowed');
      }
      // Ensure the directory exists or create it
      try {
        await mkdir(resolved, { recursive: true });
      } catch {
        throw AppError.internal('Failed to create project directory');
      }
      projectPath = resolved;
    } else {
      // Auto-generate path
      projectPath = path.join(this.projectsBasePath, userId, dto.name);
      try {
        await mkdir(projectPath, { recursive: true });
      } catch {
        throw AppError.internal('Failed to create project directory');
      }
    }

    // Create project entity
    const project = this.projectRepository.create({
      name: dto.name,
      type: dto.type,
      description: dto.description,
      path: projectPath,
      userId,
      status: 'active',
    });

    await this.projectRepository.save(project);

    return project;
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    return project;
  }

  /**
   * Update a project
   */
  async updateProject(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto
  ): Promise<Project> {
    const project = await this.getProject(projectId, userId);

    // Update fields
    if (dto.name) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status) project.status = dto.status;

    await this.projectRepository.save(project);

    return project;
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await this.getProject(projectId, userId);

    await this.projectRepository.remove(project);

    // TODO: Clean up project directory
    // For now, we keep the directory for safety
  }

  /**
   * Get project statistics
   */
  async getProjectStats(userId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    byType: Record<string, number>;
  }> {
    const projects = await this.getUserProjects(userId);

    const stats = {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      inactive: projects.filter((p) => p.status === 'inactive').length,
      archived: projects.filter((p) => p.status === 'archived').length,
      byType: projects.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return stats;
  }
}
