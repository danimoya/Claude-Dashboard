/**
 * Zod validation schemas for Claude Dashboard
 */

import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['claude-code', 'claude-b']),
  description: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export const CreateSessionSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['claude-code', 'claude-b']),
});

export const ExecuteCommandSchema = z.object({
  sessionId: z.string().uuid(),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
});

export const TranscribeAudioSchema = z.object({
  audio: z.instanceof(Buffer),
  language: z.string().optional(),
});

export const EnhancePromptSchema = z.object({
  prompt: z.string().min(1),
  provider: z.enum(['openai', 'anthropic']).default('openai'),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;
export type CreateSessionDto = z.infer<typeof CreateSessionSchema>;
export type ExecuteCommandDto = z.infer<typeof ExecuteCommandSchema>;
export type TranscribeAudioDto = z.infer<typeof TranscribeAudioSchema>;
export type EnhancePromptDto = z.infer<typeof EnhancePromptSchema>;
