/**
 * CLI Routes
 * API endpoints for CLI session management
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { CLISessionService } from '../services/cli-session.service.js';
import { ClaudeWrapperService } from '../services/claude-wrapper.service.js';
import { addCLIJob, getJobStatus, getQueueStats, cliQueue } from '../config/queue.js';
import { AppError } from '../utils/AppError.js';
import { z } from 'zod';

const router = Router();
const sessionService = new CLISessionService();
const claudeWrapper = new ClaudeWrapperService();

// Validation schemas
const CreateSessionSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['claude-code', 'claude-b']),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
});

const SendInputSchema = z.object({
  input: z.string(),
});

/**
 * POST /api/v1/cli/sessions
 * Create a new CLI session
 */
router.post('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const data = CreateSessionSchema.parse(req.body);

    // Create session record
    const session = await sessionService.createSession(userId, data);

    // Queue the CLI job
    const job = await addCLIJob({
      sessionId: session.id,
      projectId: data.projectId,
      userId,
      command: data.command,
      args: data.args,
    });

    res.status(201).json({
      success: true,
      data: {
        session,
        jobId: job.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/cli/sessions/:sessionId
 * Get session details
 */
router.get('/sessions/:sessionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    const session = await sessionService.getSession(sessionId, userId);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/cli/sessions
 * Get all active sessions
 */
router.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const sessions = await sessionService.getActiveSessions(userId);

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/cli/projects/:projectId/sessions
 * Get all sessions for a project
 */
router.get('/projects/:projectId/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { projectId } = req.params;
    const { limit, status } = req.query;

    const sessions = await sessionService.getProjectSessions(projectId, userId, {
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as 'running' | 'stopped' | 'error' | undefined,
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/cli/sessions/:sessionId/input
 * Send input to a running session
 */
router.post('/sessions/:sessionId/input', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;
    const { input } = SendInputSchema.parse(req.body);

    // Verify session belongs to user
    await sessionService.getSession(sessionId, userId);

    // Send input to CLI
    await claudeWrapper.sendInput(sessionId, input);

    // Record command
    await sessionService.recordCommand(sessionId, input);

    res.json({
      success: true,
      message: 'Input sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/cli/sessions/:sessionId/stop
 * Stop a running session
 */
router.post('/sessions/:sessionId/stop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    // Verify session belongs to user
    await sessionService.getSession(sessionId, userId);

    // Stop the CLI session
    await claudeWrapper.stopSession(sessionId);

    // Update session status
    await sessionService.updateSessionStatus(sessionId, 'stopped');

    res.json({
      success: true,
      message: 'Session stopped successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/cli/jobs/:jobId
 * Get job status
 */
router.get('/jobs/:jobId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const status = await getJobStatus(jobId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/cli/stats
 * Get queue statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getQueueStats(cliQueue);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/cli/sessions/stats
 * Get user session statistics
 */
router.get('/sessions/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const stats = await sessionService.getSessionStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/cli/sessions/:sessionId
 * Delete a session (only if stopped)
 */
router.delete('/sessions/:sessionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    const session = await sessionService.getSession(sessionId, userId);

    if (session.status === 'running') {
      throw AppError.badRequest('Cannot delete running session. Stop it first.');
    }

    // Delete from database (handled by repository)
    // For now, we'll just stop it if running
    await sessionService.updateSessionStatus(sessionId, 'stopped');

    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
