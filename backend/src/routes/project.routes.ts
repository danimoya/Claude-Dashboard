/**
 * Project Routes
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { CreateProjectSchema, UpdateProjectSchema } from '@shared/schemas';
import { ProjectService } from '../services/project.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
const projectService = new ProjectService();

// All project routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateProjectSchema.parse(req.body);
    const project = await projectService.createProject(req.userId!, dto);

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects
 * Get all user projects
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await projectService.getUserProjects(req.userId!);

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/stats
 * Get project statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await projectService.getProjectStats(req.userId!);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:id
 * Get a single project
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getProject(req.params.id, req.userId!);

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/projects/:id
 * Update a project
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = UpdateProjectSchema.parse(req.body);
    const project = await projectService.updateProject(req.params.id, req.userId!, dto);

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/projects/:id
 * Delete a project
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await projectService.deleteProject(req.params.id, req.userId!);

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
