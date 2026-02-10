/**
 * File Routes
 * API endpoints for project file operations
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { ProjectService } from '../services/project.service.js';
import { AppError } from '../utils/AppError.js';
import { z } from 'zod';
import path from 'path';
import { readdir, readFile, writeFile, mkdir, rm, stat, rename } from 'fs/promises';

const router = Router();
const projectService = new ProjectService();

// All file routes require authentication
router.use(authenticate);

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
}

/**
 * Validate that a file path is within the project directory (prevent traversal)
 */
function validatePath(projectPath: string, filePath: string): string {
  const resolved = path.resolve(projectPath, filePath);
  if (!resolved.startsWith(path.resolve(projectPath))) {
    throw AppError.badRequest('Invalid file path');
  }
  return resolved;
}

/**
 * Recursively build file tree
 */
async function buildFileTree(dirPath: string, basePath: string, depth = 0): Promise<FileTreeNode[]> {
  if (depth > 10) return [];

  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, basePath, depth + 1);
      nodes.push({ name: entry.name, path: relativePath, type: 'directory', children });
    } else {
      const fileStat = await stat(fullPath);
      nodes.push({ name: entry.name, path: relativePath, type: 'file', size: fileStat.size });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * GET /api/v1/files/projects/:projectId/tree
 * Get file tree for a project
 */
router.get('/projects/:projectId/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getProject(req.params.projectId, req.userId!);
    const tree = await buildFileTree(project.path, project.path);
    res.json({ success: true, data: tree });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/files/projects/:projectId/read
 * Read file content
 */
router.get('/projects/:projectId/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) throw AppError.badRequest('File path is required');

    const project = await projectService.getProject(req.params.projectId, req.userId!);
    const absolutePath = validatePath(project.path, filePath);
    const content = await readFile(absolutePath, 'utf-8');

    res.json({ success: true, data: { content, path: filePath } });
  } catch (error: any) {
    if (error.code === 'ENOENT') return next(AppError.notFound('File not found'));
    next(error);
  }
});

/**
 * PUT /api/v1/files/projects/:projectId/write
 * Write file content
 */
const WriteFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

router.put('/projects/:projectId/write', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, content } = WriteFileSchema.parse(req.body);
    const project = await projectService.getProject(req.params.projectId, req.userId!);
    const absolutePath = validatePath(project.path, filePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf-8');

    res.json({ success: true, message: 'File saved' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/files/projects/:projectId/create
 * Create file or directory
 */
const CreateFileSchema = z.object({
  path: z.string().min(1),
  type: z.enum(['file', 'directory']),
});

router.post('/projects/:projectId/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, type } = CreateFileSchema.parse(req.body);
    const project = await projectService.getProject(req.params.projectId, req.userId!);
    const absolutePath = validatePath(project.path, filePath);

    if (type === 'directory') {
      await mkdir(absolutePath, { recursive: true });
    } else {
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, '', 'utf-8');
    }

    res.status(201).json({ success: true, message: `${type} created` });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/files/projects/:projectId/delete
 * Delete file or directory
 */
router.delete('/projects/:projectId/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) throw AppError.badRequest('File path is required');

    const project = await projectService.getProject(req.params.projectId, req.userId!);
    const absolutePath = validatePath(project.path, filePath);

    await rm(absolutePath, { recursive: true });
    res.json({ success: true, message: 'Deleted' });
  } catch (error: any) {
    if (error.code === 'ENOENT') return next(AppError.notFound('File not found'));
    next(error);
  }
});

/**
 * PATCH /api/v1/files/projects/:projectId/rename
 * Rename file or directory
 */
const RenameSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
});

router.patch('/projects/:projectId/rename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oldPath, newPath } = RenameSchema.parse(req.body);
    const project = await projectService.getProject(req.params.projectId, req.userId!);
    const absoluteOld = validatePath(project.path, oldPath);
    const absoluteNew = validatePath(project.path, newPath);

    await rename(absoluteOld, absoluteNew);
    res.json({ success: true, message: 'Renamed' });
  } catch (error: any) {
    if (error.code === 'ENOENT') return next(AppError.notFound('File not found'));
    next(error);
  }
});

export default router;
