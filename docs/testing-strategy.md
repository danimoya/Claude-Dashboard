# Claude Dashboard - Comprehensive Testing Strategy

## Executive Summary

This document outlines a comprehensive testing strategy for the Claude Dashboard project, covering unit tests, integration tests, E2E tests, performance testing, security testing, and accessibility validation. The strategy ensures >80% code coverage and robust quality assurance across all components.

## Testing Framework Recommendations

### Frontend Testing Stack

**Primary Framework: Vitest + Testing Library**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitest/ui": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "jsdom": "^23.0.0"
  }
}
```

**E2E Framework: Playwright**
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0"
  }
}
```

**Visual Regression: Playwright + Percy**
```json
{
  "devDependencies": {
    "@percy/playwright": "^1.0.0"
  }
}
```

**Accessibility Testing: axe-core + pa11y**
```json
{
  "devDependencies": {
    "axe-core": "^4.8.0",
    "axe-playwright": "^1.2.0",
    "pa11y": "^7.0.0",
    "pa11y-ci": "^3.0.0"
  }
}
```

### Backend Testing Stack

**Primary Framework: Jest + Supertest**
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^2.0.0",
    "testcontainers": "^10.2.0"
  }
}
```

**Performance Testing: k6**
```bash
# Install k6 for load testing
brew install k6
# or
curl -L https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar xvz
```

**Security Testing: OWASP ZAP + Snyk**
```json
{
  "devDependencies": {
    "snyk": "^1.1200.0",
    "npm-audit": "^2.0.0"
  }
}
```

## Test Coverage Requirements

### Overall Coverage Targets
- **Statements**: ≥85%
- **Branches**: ≥80%
- **Functions**: ≥85%
- **Lines**: ≥85%

### Critical Path Coverage
- Authentication flows: **100%**
- CLI wrapper execution: **100%**
- File operations: **95%**
- WebSocket communication: **90%**
- Voice transcription: **85%**

### Coverage Exclusions
```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/types/**',
        'tests/**'
      ]
    }
  }
});
```

## 1. Unit Testing Strategy

### 1.1 Frontend Unit Tests

#### Component Testing Pattern
```typescript
// frontend/src/components/__tests__/VoiceInput.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceInput } from '../VoiceInput';

describe('VoiceInput Component', () => {
  let mockMediaRecorder: any;
  let mockStream: MediaStream;

  beforeEach(() => {
    // Mock MediaRecorder API
    mockStream = new MediaStream();
    mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
      state: 'inactive'
    };

    global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any;

    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream)
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render voice input button', () => {
    render(<VoiceInput onTranscript={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should request microphone permission on click', async () => {
    const user = userEvent.setup();
    render(<VoiceInput onTranscript={vi.fn()} />);

    await user.click(screen.getByRole('button'));

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true
    });
  });

  it('should start recording when button clicked', async () => {
    const user = userEvent.setup();
    render(<VoiceInput onTranscript={vi.fn()} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });
  });

  it('should stop recording and call onTranscript', async () => {
    const onTranscript = vi.fn();
    const user = userEvent.setup();

    // Mock API call
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ transcript: 'test transcript' })
    }) as any;

    render(<VoiceInput onTranscript={onTranscript} />);

    // Start recording
    await user.click(screen.getByRole('button'));

    // Simulate data available
    const blob = new Blob(['audio data'], { type: 'audio/wav' });
    mockMediaRecorder.ondataavailable?.({ data: blob });

    // Stop recording
    await user.click(screen.getByRole('button'));
    mockMediaRecorder.onstop?.();

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('test transcript');
    });
  });

  it('should handle microphone access denial gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    navigator.mediaDevices.getUserMedia = vi.fn()
      .mockRejectedValue(new Error('Permission denied'));

    const user = userEvent.setup();
    render(<VoiceInput onTranscript={vi.fn()} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
```

#### State Management Testing
```typescript
// frontend/src/stores/__tests__/authStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../authStore';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });
  });

  it('should initialize with null user', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('should login successfully with valid credentials', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        token: 'test-token',
        user: { id: '1', username: 'testuser' }
      })
    }) as any;

    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login({
        username: 'testuser',
        password: 'password123'
      });
    });

    expect(result.current.user).toEqual({
      id: '1',
      username: 'testuser'
    });
    expect(result.current.token).toBe('test-token');
    expect(localStorage.getItem('auth-token')).toBe('test-token');
  });

  it('should handle login failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid credentials' })
    }) as any;

    const { result } = renderHook(() => useAuthStore());

    await expect(act(async () => {
      await result.current.login({
        username: 'testuser',
        password: 'wrong'
      });
    })).rejects.toThrow();

    expect(result.current.user).toBeNull();
  });

  it('should logout and clear state', () => {
    const { result } = renderHook(() => useAuthStore());

    // Set initial state
    act(() => {
      result.current.setUser({ id: '1', username: 'test' });
      result.current.setToken('test-token');
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('auth-token')).toBeNull();
  });
});
```

### 1.2 Backend Unit Tests

#### Service Layer Testing
```typescript
// backend/src/services/__tests__/claude-wrapper.service.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { ClaudeWrapperService } from '../claude-wrapper.service';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process');

describe('ClaudeWrapperService', () => {
  let service: ClaudeWrapperService;
  let mockProcess: EventEmitter;

  beforeEach(() => {
    service = new ClaudeWrapperService();

    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    (mockProcess as any).kill = vi.fn();

    // Mock spawn to return our mock process
    (spawn as any).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute Claude command successfully', async () => {
    const sessionId = 'test-session';
    const command = 'code';
    const args = ['--help'];

    const executionPromise = service.executeCommand(sessionId, command, args);

    // Verify spawn was called correctly
    expect(spawn).toHaveBeenCalledWith('claude', [command, ...args], {
      cwd: expect.any(String),
      env: expect.objectContaining(process.env)
    });

    // Simulate successful completion
    mockProcess.stdout.emit('data', Buffer.from('Claude Code v1.0.0'));
    mockProcess.emit('exit', 0);

    await executionPromise;
  });

  it('should handle command execution errors', async () => {
    const sessionId = 'test-session';

    const executionPromise = service.executeCommand(sessionId, 'code', []);

    // Simulate error
    mockProcess.stderr.emit('data', Buffer.from('Error: Command failed'));
    mockProcess.emit('exit', 1);

    await expect(executionPromise).rejects.toThrow('Command failed');
  });

  it('should stream output in real-time', (done) => {
    const sessionId = 'test-session';
    const outputChunks: string[] = [];

    service.on(`output:${sessionId}`, (data: string) => {
      outputChunks.push(data);
    });

    service.executeCommand(sessionId, 'code', ['--verbose']);

    // Simulate multiple output chunks
    setTimeout(() => mockProcess.stdout.emit('data', Buffer.from('Line 1\n')), 10);
    setTimeout(() => mockProcess.stdout.emit('data', Buffer.from('Line 2\n')), 20);
    setTimeout(() => mockProcess.stdout.emit('data', Buffer.from('Line 3\n')), 30);
    setTimeout(() => {
      mockProcess.emit('exit', 0);
      expect(outputChunks).toHaveLength(3);
      expect(outputChunks).toEqual(['Line 1\n', 'Line 2\n', 'Line 3\n']);
      done();
    }, 50);
  });

  it('should stop session and kill process', async () => {
    const sessionId = 'test-session';

    service.executeCommand(sessionId, 'code', []);

    await service.stopSession(sessionId);

    expect((mockProcess as any).kill).toHaveBeenCalled();
  });

  it('should handle concurrent sessions', async () => {
    const session1 = 'session-1';
    const session2 = 'session-2';

    service.executeCommand(session1, 'code', []);
    service.executeCommand(session2, 'flow', []);

    const activeSessions = service.getActiveSessions();
    expect(activeSessions).toHaveLength(2);
    expect(activeSessions).toContain(session1);
    expect(activeSessions).toContain(session2);
  });

  it('should timeout long-running processes', async () => {
    const sessionId = 'timeout-session';

    const executionPromise = service.executeCommand(sessionId, 'code', [], {
      timeout: 100 // 100ms timeout
    });

    // Don't emit exit - let it timeout
    await expect(executionPromise).rejects.toThrow('Execution timeout');
  });
});
```

#### Repository Layer Testing
```typescript
// backend/src/repositories/__tests__/project.repository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { ProjectRepository } from '../project.repository';
import { Project } from '../../entities/Project';

describe('ProjectRepository', () => {
  let dataSource: DataSource;
  let repository: ProjectRepository;

  beforeAll(async () => {
    // Use in-memory SQLite for testing
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Project],
      synchronize: true,
      logging: false
    });
    await dataSource.initialize();
    repository = new ProjectRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Clear all projects before each test
    await dataSource.getRepository(Project).clear();
  });

  it('should create a new project', async () => {
    const projectData = {
      name: 'Test Project',
      type: 'claude-code' as const,
      path: '/tmp/test-project',
      userId: 'user-123'
    };

    const project = await repository.create(projectData);

    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.type).toBe('claude-code');
    expect(project.status).toBe('inactive');
    expect(project.createdAt).toBeInstanceOf(Date);
  });

  it('should find project by id', async () => {
    const created = await repository.create({
      name: 'Find Test',
      type: 'claude-b',
      path: '/tmp/find-test',
      userId: 'user-123'
    });

    const found = await repository.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Find Test');
  });

  it('should list projects by user', async () => {
    await repository.create({
      name: 'Project 1',
      type: 'claude-code',
      path: '/tmp/p1',
      userId: 'user-123'
    });

    await repository.create({
      name: 'Project 2',
      type: 'claude-b',
      path: '/tmp/p2',
      userId: 'user-123'
    });

    await repository.create({
      name: 'Other User Project',
      type: 'claude-code',
      path: '/tmp/other',
      userId: 'user-456'
    });

    const projects = await repository.findByUserId('user-123');

    expect(projects).toHaveLength(2);
    expect(projects.map(p => p.name)).toContain('Project 1');
    expect(projects.map(p => p.name)).toContain('Project 2');
    expect(projects.map(p => p.name)).not.toContain('Other User Project');
  });

  it('should update project status', async () => {
    const project = await repository.create({
      name: 'Status Test',
      type: 'claude-code',
      path: '/tmp/status',
      userId: 'user-123'
    });

    await repository.updateStatus(project.id, 'active');

    const updated = await repository.findById(project.id);
    expect(updated?.status).toBe('active');
  });

  it('should delete project', async () => {
    const project = await repository.create({
      name: 'Delete Test',
      type: 'claude-code',
      path: '/tmp/delete',
      userId: 'user-123'
    });

    await repository.delete(project.id);

    const found = await repository.findById(project.id);
    expect(found).toBeNull();
  });

  it('should enforce unique names per user', async () => {
    await repository.create({
      name: 'Unique Project',
      type: 'claude-code',
      path: '/tmp/unique1',
      userId: 'user-123'
    });

    await expect(repository.create({
      name: 'Unique Project',
      type: 'claude-b',
      path: '/tmp/unique2',
      userId: 'user-123'
    })).rejects.toThrow();
  });
});
```

## 2. Integration Testing Strategy

### 2.1 API Integration Tests

```typescript
// tests/integration/api/projects.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { createTestApp } from '../../helpers/test-app';
import { TestDatabase } from '../../helpers/test-database';

describe('Projects API Integration', () => {
  let app: Application;
  let db: TestDatabase;
  let authToken: string;

  beforeAll(async () => {
    db = await TestDatabase.create();
    app = await createTestApp(db);

    // Create test user and get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.clearProjects();
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Test Project',
          type: 'claude-code',
          description: 'Test project'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Integration Test Project',
        type: 'claude-code',
        status: 'inactive'
      });
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .post('/api/projects')
        .send({
          name: 'Test',
          type: 'claude-code'
        })
        .expect(401);
    });

    it('should validate project name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          type: 'claude-code'
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should validate project type', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          type: 'invalid-type'
        })
        .expect(400);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Project 1', type: 'claude-code' });

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Project 2', type: 'claude-b' });
    });

    it('should list user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/projects?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2
      });
    });

    it('should support filtering by type', async () => {
      const response = await request(app)
        .get('/api/projects?type=claude-code')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('claude-code');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get project by id', async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Get Test', type: 'claude-code' });

      const response = await request(app)
        .get(`/api/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(created.body.id);
      expect(response.body.name).toBe('Get Test');
    });

    it('should return 404 for non-existent project', async () => {
      await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow access to other users projects', async () => {
      // Create project with different user
      const otherUser = await request(app)
        .post('/api/auth/login')
        .send({ username: 'otheruser', password: 'otherpass' });

      const otherProject = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${otherUser.body.token}`)
        .send({ name: 'Other Project', type: 'claude-code' });

      // Try to access with first user
      await request(app)
        .get(`/api/projects/${otherProject.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Delete Test', type: 'claude-code' });

      await request(app)
        .delete(`/api/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should cleanup project files on deletion', async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cleanup Test', type: 'claude-code' });

      const projectPath = created.body.path;

      await request(app)
        .delete(`/api/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify files deleted
      const fs = await import('fs/promises');
      await expect(fs.access(projectPath)).rejects.toThrow();
    });
  });
});
```

### 2.2 Claude CLI Wrapper Integration Tests

```typescript
// tests/integration/claude-wrapper.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ClaudeWrapperService } from '../../backend/src/services/claude-wrapper.service';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Claude CLI Wrapper Integration', () => {
  let service: ClaudeWrapperService;
  let testProjectPath: string;

  beforeAll(async () => {
    service = new ClaudeWrapperService();

    // Create temporary test project
    testProjectPath = path.join(os.tmpdir(), `test-project-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });

    // Initialize test project
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' })
    );
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(testProjectPath, { recursive: true, force: true });
  });

  it('should execute Claude Code help command', async () => {
    const sessionId = 'help-session';
    const outputs: string[] = [];

    service.on(`output:${sessionId}`, (data: string) => {
      outputs.push(data);
    });

    await service.executeCommand(sessionId, 'code', ['--help'], {
      cwd: testProjectPath
    });

    expect(outputs.join('')).toContain('Usage:');
    expect(outputs.join('')).toContain('claude');
  }, 30000);

  it('should execute Claude Code with prompt', async () => {
    const sessionId = 'prompt-session';
    const prompt = 'Create a simple Hello World function in hello.js';

    await service.executeCommand(sessionId, 'code', [
      '--prompt',
      prompt,
      '--auto-approve'
    ], {
      cwd: testProjectPath
    });

    // Verify file was created
    const helloPath = path.join(testProjectPath, 'hello.js');
    const exists = await fs.access(helloPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  }, 60000);

  it('should handle Claude-B initialization', async () => {
    const sessionId = 'flow-init-session';

    await service.executeCommand(sessionId, 'flow', ['init'], {
      cwd: testProjectPath
    });

    // Verify .claude-b directory was created
    const flowPath = path.join(testProjectPath, '.claude-b');
    const exists = await fs.access(flowPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  }, 30000);

  it('should stream output in real-time', (done) => {
    const sessionId = 'stream-session';
    const chunks: string[] = [];
    let chunkCount = 0;

    service.on(`output:${sessionId}`, (data: string) => {
      chunks.push(data);
      chunkCount++;

      // Verify we're getting incremental updates
      if (chunkCount >= 3) {
        expect(chunks.length).toBeGreaterThanOrEqual(3);
        done();
      }
    });

    service.executeCommand(sessionId, 'code', ['--verbose', '--help'], {
      cwd: testProjectPath
    });
  }, 30000);

  it('should handle command interruption', async () => {
    const sessionId = 'interrupt-session';

    // Start long-running command
    const promise = service.executeCommand(sessionId, 'code', [
      '--prompt',
      'Create a very complex application with many features',
      '--verbose'
    ], {
      cwd: testProjectPath
    });

    // Wait a bit then interrupt
    await new Promise(resolve => setTimeout(resolve, 2000));
    await service.stopSession(sessionId);

    // Should not throw
    await expect(promise).rejects.toThrow('Session terminated');
  }, 30000);

  it('should handle concurrent sessions', async () => {
    const session1 = 'concurrent-1';
    const session2 = 'concurrent-2';

    const promise1 = service.executeCommand(session1, 'code', ['--version']);
    const promise2 = service.executeCommand(session2, 'flow', ['--version']);

    const results = await Promise.all([promise1, promise2]);

    expect(results).toHaveLength(2);
  }, 30000);

  it('should sanitize malicious commands', async () => {
    const sessionId = 'sanitize-session';

    // Try command injection
    await expect(service.executeCommand(sessionId, 'code', [
      '--prompt',
      'test; rm -rf /'
    ], {
      cwd: testProjectPath
    })).rejects.toThrow('Invalid command');
  });

  it('should respect working directory', async () => {
    const sessionId = 'cwd-session';
    const subdir = path.join(testProjectPath, 'subdir');
    await fs.mkdir(subdir, { recursive: true });

    await service.executeCommand(sessionId, 'code', [
      '--prompt',
      'Create test.txt file'
    ], {
      cwd: subdir
    });

    const testFile = path.join(subdir, 'test.txt');
    const exists = await fs.access(testFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  }, 30000);
});
```

### 2.3 WebSocket Integration Tests

```typescript
// tests/integration/websocket.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { io, Socket } from 'socket.io-client';
import { createTestServer } from '../../tests/helpers/test-server';
import { Server } from 'http';

describe('WebSocket Integration', () => {
  let httpServer: Server;
  let serverUrl: string;
  let client: Socket;

  beforeAll(async () => {
    const testServer = await createTestServer();
    httpServer = testServer.server;
    serverUrl = testServer.url;
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  beforeEach((done) => {
    client = io(serverUrl, {
      transports: ['websocket'],
      auth: { token: 'test-token' }
    });
    client.on('connect', done);
  });

  afterEach(() => {
    if (client.connected) {
      client.disconnect();
    }
  });

  it('should connect to WebSocket server', (done) => {
    expect(client.connected).toBe(true);
    done();
  });

  it('should join session room', (done) => {
    const sessionId = 'test-session-123';

    client.emit('join-session', sessionId);

    client.on('session-joined', (data) => {
      expect(data.sessionId).toBe(sessionId);
      done();
    });
  });

  it('should receive real-time log updates', (done) => {
    const sessionId = 'log-session';
    const receivedLogs: string[] = [];

    client.emit('join-session', sessionId);

    client.on('log:stream', (log) => {
      receivedLogs.push(log);

      if (receivedLogs.length === 3) {
        expect(receivedLogs).toEqual([
          expect.stringContaining('Starting'),
          expect.stringContaining('Processing'),
          expect.stringContaining('Complete')
        ]);
        done();
      }
    });

    // Simulate server sending logs
    setTimeout(() => {
      client.emit('test:send-logs', sessionId, [
        'Starting process...',
        'Processing files...',
        'Complete!'
      ]);
    }, 100);
  });

  it('should handle execute-command event', (done) => {
    const sessionId = 'cmd-session';

    client.emit('join-session', sessionId);

    client.on('command-started', (data) => {
      expect(data.sessionId).toBe(sessionId);
      expect(data.command).toBe('code');
    });

    client.on('command-completed', (data) => {
      expect(data.sessionId).toBe(sessionId);
      expect(data.exitCode).toBe(0);
      done();
    });

    client.emit('execute-command', {
      sessionId,
      command: 'code',
      args: ['--version']
    });
  }, 10000);

  it('should broadcast project status updates', (done) => {
    const projectId = 'project-123';

    client.emit('subscribe-project', projectId);

    client.on('project:status', (data) => {
      expect(data.projectId).toBe(projectId);
      expect(data.status).toBe('active');
      done();
    });

    // Simulate status change
    setTimeout(() => {
      client.emit('test:update-project-status', projectId, 'active');
    }, 100);
  });

  it('should handle disconnection gracefully', (done) => {
    const sessionId = 'disconnect-session';

    client.emit('join-session', sessionId);

    client.on('disconnect', () => {
      expect(client.connected).toBe(false);
      done();
    });

    setTimeout(() => {
      client.disconnect();
    }, 100);
  });

  it('should support multiple concurrent connections', async () => {
    const clients: Socket[] = [];
    const connectPromises: Promise<void>[] = [];

    for (let i = 0; i < 5; i++) {
      const promise = new Promise<void>((resolve) => {
        const newClient = io(serverUrl, {
          transports: ['websocket'],
          auth: { token: `test-token-${i}` }
        });
        newClient.on('connect', resolve);
        clients.push(newClient);
      });
      connectPromises.push(promise);
    }

    await Promise.all(connectPromises);

    expect(clients.every(c => c.connected)).toBe(true);

    // Cleanup
    clients.forEach(c => c.disconnect());
  });

  it('should handle authentication errors', (done) => {
    const unauthorizedClient = io(serverUrl, {
      transports: ['websocket'],
      auth: { token: 'invalid-token' }
    });

    unauthorizedClient.on('connect_error', (error) => {
      expect(error.message).toContain('Authentication');
      unauthorizedClient.disconnect();
      done();
    });
  });

  it('should rate limit message sending', (done) => {
    const messages: string[] = [];

    client.on('rate-limit-exceeded', () => {
      expect(messages.length).toBeGreaterThan(100);
      done();
    });

    // Send many messages rapidly
    for (let i = 0; i < 200; i++) {
      client.emit('test-message', `Message ${i}`);
      messages.push(`Message ${i}`);
    }
  });
});
```

## 3. End-to-End Testing Strategy

### 3.1 Playwright E2E Tests

```typescript
// tests/e2e/complete-workflow.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Complete User Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test('should complete full project creation workflow', async () => {
    // 1. Login
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');

    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Claude Dashboard');

    // 2. Create new project
    await page.click('text=New Project');
    await page.fill('[name=projectName]', 'E2E Test Project');
    await page.selectOption('[name=projectType]', 'claude-code');
    await page.fill('[name=description]', 'End-to-end test project');
    await page.click('text=Create');

    await page.waitForSelector('text=E2E Test Project');

    // 3. Open project
    await page.click('text=E2E Test Project');
    await page.waitForSelector('[data-testid=workspace]');

    // 4. Browse files
    await page.click('[data-testid=file-browser]');
    await expect(page.locator('[data-testid=file-tree]')).toBeVisible();

    // 5. Create new file
    await page.click('[data-testid=new-file-button]');
    await page.fill('[data-testid=file-name-input]', 'test.js');
    await page.click('[data-testid=confirm-create]');

    await expect(page.locator('text=test.js')).toBeVisible();

    // 6. Edit file
    await page.click('text=test.js');
    const editor = page.locator('[data-testid=code-editor]');
    await editor.fill('console.log("Hello from E2E test");');

    await page.click('[data-testid=save-file]');
    await expect(page.locator('text=Saved')).toBeVisible();

    // 7. Run Claude Code
    await page.click('[data-testid=run-claude]');
    await page.fill('[data-testid=prompt-input]', 'Add error handling to test.js');
    await page.click('[data-testid=execute-prompt]');

    // Wait for execution
    await expect(page.locator('[data-testid=terminal]')).toContainText('Processing', {
      timeout: 30000
    });

    // 8. View terminal output
    const terminal = page.locator('[data-testid=terminal]');
    await expect(terminal).toBeVisible();

    // 9. Check infrastructure
    await page.click('[data-testid=infrastructure-tab]');
    await expect(page.locator('[data-testid=container-list]')).toBeVisible();

    // 10. Logout
    await page.click('[data-testid=user-menu]');
    await page.click('text=Logout');
    await page.waitForURL('/');
  });

  test('should handle voice input workflow', async () => {
    // Login
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    // Open project
    await page.click('text=E2E Test Project');

    // Navigate to prompt builder
    await page.click('[data-testid=prompt-tab]');

    // Mock audio input
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          transcript: 'Create a REST API with authentication'
        })
      });
    });

    // Grant microphone permission (in test context)
    await page.context().grantPermissions(['microphone']);

    // Start voice recording
    await page.click('[data-testid=voice-input-button]');
    await expect(page.locator('[data-testid=recording-indicator]')).toBeVisible();

    // Simulate recording
    await page.waitForTimeout(2000);

    // Stop recording
    await page.click('[data-testid=voice-input-button]');

    // Verify transcript appeared
    await expect(page.locator('[data-testid=prompt-input]'))
      .toContainText('Create a REST API with authentication');

    // Enhance prompt
    await page.click('[data-testid=enhance-button]');
    await expect(page.locator('[data-testid=enhanced-prompt]')).toBeVisible({
      timeout: 10000
    });

    // Execute enhanced prompt
    await page.click('[data-testid=use-enhanced]');
    await page.click('[data-testid=execute-prompt]');

    await expect(page.locator('[data-testid=terminal]')).toContainText('Processing');
  });

  test('should handle error scenarios gracefully', async () => {
    // Login
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    // Try to create project with invalid name
    await page.click('text=New Project');
    await page.fill('[name=projectName]', '');
    await page.click('text=Create');

    await expect(page.locator('[data-testid=error-message]'))
      .toContainText('Project name is required');

    // Try with very long name
    const longName = 'a'.repeat(300);
    await page.fill('[name=projectName]', longName);
    await page.click('text=Create');

    await expect(page.locator('[data-testid=error-message]'))
      .toContainText('Project name too long');

    // Try to execute empty prompt
    await page.click('text=Test Project');
    await page.click('[data-testid=run-claude]');
    await page.click('[data-testid=execute-prompt]');

    await expect(page.locator('[data-testid=error-message]'))
      .toContainText('Prompt cannot be empty');
  });

  test('should handle session timeout', async () => {
    // Login
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    // Simulate session expiry by clearing auth token
    await page.evaluate(() => {
      localStorage.removeItem('auth-token');
    });

    // Try to navigate
    await page.click('text=New Project');

    // Should redirect to login
    await page.waitForURL('/');
    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('should support keyboard shortcuts', async () => {
    // Login and open project
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    await page.click('text=Test Project');

    // Test Cmd/Ctrl+S to save
    await page.click('text=test.js');
    await page.keyboard.press('Meta+S'); // or 'Control+S' on Windows
    await expect(page.locator('text=Saved')).toBeVisible();

    // Test Cmd/Ctrl+K for command palette
    await page.keyboard.press('Meta+K');
    await expect(page.locator('[data-testid=command-palette]')).toBeVisible();

    // Test Esc to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid=command-palette]')).not.toBeVisible();
  });
});
```

### 3.2 Visual Regression Testing

```typescript
// tests/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
  });

  test('dashboard layout', async ({ page }) => {
    await percySnapshot(page, 'Dashboard - Main View');
  });

  test('project workspace', async ({ page }) => {
    await page.click('text=Test Project');
    await page.waitForSelector('[data-testid=workspace]');
    await percySnapshot(page, 'Workspace - File Browser');
  });

  test('terminal view', async ({ page }) => {
    await page.click('text=Test Project');
    await page.click('[data-testid=terminal-tab]');
    await percySnapshot(page, 'Terminal - Empty State');
  });

  test('prompt builder', async ({ page }) => {
    await page.click('text=Test Project');
    await page.click('[data-testid=prompt-tab]');
    await percySnapshot(page, 'Prompt Builder - Empty');

    await page.fill('[data-testid=prompt-input]', 'Test prompt');
    await percySnapshot(page, 'Prompt Builder - With Text');
  });

  test('responsive layouts', async ({ page }) => {
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await percySnapshot(page, 'Dashboard - Mobile');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await percySnapshot(page, 'Dashboard - Tablet');

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await percySnapshot(page, 'Dashboard - Desktop');
  });

  test('dark mode', async ({ page }) => {
    await page.click('[data-testid=theme-toggle]');
    await percySnapshot(page, 'Dashboard - Dark Mode');
  });

  test('error states', async ({ page }) => {
    await page.click('text=New Project');
    await page.click('text=Create'); // Submit without filling
    await percySnapshot(page, 'Form - Validation Errors');
  });
});
```

## 4. Voice Input Testing

### 4.1 Voice Service Tests

```typescript
// tests/unit/voice-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceService } from '../../backend/src/services/voice.service';

describe('Voice Service', () => {
  let service: VoiceService;
  let mockFetch: any;

  beforeEach(() => {
    service = new VoiceService({
      apiKey: 'test-key',
      provider: 'speechmatics'
    });

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  it('should transcribe audio successfully', async () => {
    const mockTranscript = 'Create a new React component';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ alternatives: [{ transcript: mockTranscript }] }]
      })
    });

    const audioBuffer = Buffer.from('fake-audio-data');
    const result = await service.transcribe(audioBuffer);

    expect(result).toBe(mockTranscript);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('speechmatics.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key'
        })
      })
    );
  });

  it('should handle transcription errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid audio format' })
    });

    const audioBuffer = Buffer.from('invalid-audio');

    await expect(service.transcribe(audioBuffer))
      .rejects.toThrow('Transcription failed');
  });

  it('should support multiple languages', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ alternatives: [{ transcript: 'Bonjour monde' }] }]
      })
    });

    const audioBuffer = Buffer.from('french-audio');
    const result = await service.transcribe(audioBuffer, { language: 'fr' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"language":"fr"')
      })
    );
  });

  it('should timeout long transcriptions', async () => {
    mockFetch.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 10000))
    );

    const audioBuffer = Buffer.from('long-audio');

    await expect(service.transcribe(audioBuffer, { timeout: 1000 }))
      .rejects.toThrow('Transcription timeout');
  });

  it('should validate audio format', async () => {
    const invalidBuffer = Buffer.from('not-audio-data');

    await expect(service.transcribe(invalidBuffer))
      .rejects.toThrow('Invalid audio format');
  });

  it('should handle rate limiting', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    });

    const audioBuffer = Buffer.from('audio-data');

    await expect(service.transcribe(audioBuffer))
      .rejects.toThrow('Rate limit exceeded');
  });
});
```

### 4.2 Voice Input E2E Tests

```typescript
// tests/e2e/voice-input.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Voice Input Integration', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permission
    await context.grantPermissions(['microphone']);

    // Login
    await page.goto('/');
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
  });

  test('should record and transcribe voice input', async ({ page }) => {
    // Mock transcription API
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transcript: 'Create a user authentication system'
        })
      });
    });

    await page.click('text=Test Project');
    await page.click('[data-testid=prompt-tab]');

    // Start recording
    await page.click('[data-testid=voice-button]');
    await expect(page.locator('[data-testid=recording-indicator]'))
      .toBeVisible();
    await expect(page.locator('[data-testid=recording-indicator]'))
      .toHaveClass(/recording/);

    // Simulate recording for 2 seconds
    await page.waitForTimeout(2000);

    // Stop recording
    await page.click('[data-testid=voice-button]');

    // Wait for transcription
    await expect(page.locator('[data-testid=transcribing-indicator]'))
      .toBeVisible();

    // Verify transcript appeared
    await expect(page.locator('[data-testid=prompt-input]'))
      .toHaveValue('Create a user authentication system');
  });

  test('should show error on microphone denial', async ({ page, context }) => {
    // Revoke microphone permission
    await context.clearPermissions();

    await page.click('text=Test Project');
    await page.click('[data-testid=prompt-tab]');
    await page.click('[data-testid=voice-button]');

    await expect(page.locator('[data-testid=error-message]'))
      .toContainText('Microphone access denied');
  });

  test('should handle transcription errors', async ({ page }) => {
    // Mock failed transcription
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Transcription failed' })
      });
    });

    await page.click('text=Test Project');
    await page.click('[data-testid=prompt-tab]');
    await page.click('[data-testid=voice-button]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid=voice-button]');

    await expect(page.locator('[data-testid=error-message]'))
      .toContainText('Transcription failed');
  });

  test('should support voice re-recording', async ({ page }) => {
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ transcript: 'First recording' })
      });
    });

    await page.click('text=Test Project');
    await page.click('[data-testid=prompt-tab]');

    // First recording
    await page.click('[data-testid=voice-button]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid=voice-button]');

    await expect(page.locator('[data-testid=prompt-input]'))
      .toHaveValue('First recording');

    // Re-record
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ transcript: 'Second recording' })
      });
    });

    await page.click('[data-testid=voice-button]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid=voice-button]');

    await expect(page.locator('[data-testid=prompt-input]'))
      .toHaveValue('Second recording');
  });
});
```

## 5. Performance Testing Strategy

### 5.1 Load Testing with k6

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],     // Less than 1% failed requests
    errors: ['rate<0.05'],              // Less than 5% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Login and get auth token
function login() {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'loadtest',
    password: 'loadtest123'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'login successful': (r) => r.status === 200,
    'received token': (r) => r.json('token') !== undefined,
  });

  return res.json('token');
}

export default function () {
  const token = login();

  group('Project Operations', () => {
    // Create project
    const createRes = http.post(
      `${BASE_URL}/api/projects`,
      JSON.stringify({
        name: `Load Test Project ${__VU}-${__ITER}`,
        type: 'claude-code',
        description: 'Load testing project'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );

    const success = check(createRes, {
      'create project status 201': (r) => r.status === 201,
      'create project has id': (r) => r.json('id') !== undefined,
    });

    errorRate.add(!success);
    apiDuration.add(createRes.timings.duration);

    if (!success) {
      return;
    }

    const projectId = createRes.json('id');

    // List projects
    const listRes = http.get(`${BASE_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    check(listRes, {
      'list projects status 200': (r) => r.status === 200,
      'list projects returns array': (r) => Array.isArray(r.json()),
    });

    // Get specific project
    const getRes = http.get(`${BASE_URL}/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    check(getRes, {
      'get project status 200': (r) => r.status === 200,
      'get project matches created': (r) => r.json('id') === projectId,
    });

    // Update project
    const updateRes = http.patch(
      `${BASE_URL}/api/projects/${projectId}`,
      JSON.stringify({ status: 'active' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );

    check(updateRes, {
      'update project status 200': (r) => r.status === 200,
    });

    // Delete project
    const deleteRes = http.del(`${BASE_URL}/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    check(deleteRes, {
      'delete project status 204': (r) => r.status === 204,
    });
  });

  group('File Operations', () => {
    // Create project for file operations
    const projectRes = http.post(
      `${BASE_URL}/api/projects`,
      JSON.stringify({
        name: `File Test ${__VU}-${__ITER}`,
        type: 'claude-code'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );

    const projectId = projectRes.json('id');

    // List files
    const filesRes = http.get(`${BASE_URL}/api/projects/${projectId}/files`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    check(filesRes, {
      'list files status 200': (r) => r.status === 200,
      'list files response time < 200ms': (r) => r.timings.duration < 200,
    });

    // Create file
    const createFileRes = http.post(
      `${BASE_URL}/api/projects/${projectId}/files`,
      JSON.stringify({
        path: 'test.js',
        content: 'console.log("load test");'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );

    check(createFileRes, {
      'create file status 201': (r) => r.status === 201,
    });

    // Read file
    const readFileRes = http.get(
      `${BASE_URL}/api/projects/${projectId}/files/test.js`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    check(readFileRes, {
      'read file status 200': (r) => r.status === 200,
      'file content correct': (r) => r.json('content') === 'console.log("load test");',
    });

    // Cleanup
    http.del(`${BASE_URL}/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  });

  sleep(1);
}

// Stress test scenario
export function stressTest() {
  const token = login();

  // Create many projects rapidly
  for (let i = 0; i < 10; i++) {
    http.post(
      `${BASE_URL}/api/projects`,
      JSON.stringify({
        name: `Stress Test ${__VU}-${i}`,
        type: 'claude-code'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
  }
}
```

### 5.2 Frontend Performance Tests

```typescript
// tests/performance/frontend-performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Frontend Performance', () => {
  test('should load dashboard within performance budget', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');

    // Measure dashboard load time
    const startTime = Date.now();
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000); // Under 3 seconds
  });

  test('should render large file tree efficiently', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock large file tree
    await page.route('**/api/projects/*/files', async (route) => {
      const largeTree = generateLargeFileTree(1000); // 1000 files
      await route.fulfill({
        status: 200,
        body: JSON.stringify(largeTree)
      });
    });

    await page.click('text=Test Project');

    const startTime = Date.now();
    await page.waitForSelector('[data-testid=file-tree]');
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(500); // Under 500ms
  });

  test('should handle rapid input without lag', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Test Project');
    await page.click('[data-testid=prompt-tab]');

    const textarea = page.locator('[data-testid=prompt-input]');

    // Type rapidly
    const text = 'a'.repeat(1000);
    const startTime = Date.now();
    await textarea.type(text, { delay: 0 });
    const typeTime = Date.now() - startTime;

    // Should handle 1000 chars in under 2 seconds
    expect(typeTime).toBeLessThan(2000);
  });

  test('should maintain 60fps during animations', async ({ page }) => {
    await page.goto('/dashboard');

    // Track FPS
    const fps = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frames = 0;
        let lastTime = performance.now();

        function measureFPS() {
          frames++;
          const currentTime = performance.now();

          if (currentTime >= lastTime + 1000) {
            resolve(frames);
          } else {
            requestAnimationFrame(measureFPS);
          }
        }

        requestAnimationFrame(measureFPS);
      });
    });

    expect(fps).toBeGreaterThanOrEqual(55); // Near 60fps
  });

  test('should not have memory leaks', async ({ page }) => {
    await page.goto('/dashboard');

    // Get initial memory
    const initialMetrics = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Perform actions that might cause leaks
    for (let i = 0; i < 10; i++) {
      await page.click('text=New Project');
      await page.keyboard.press('Escape');
    }

    // Force GC if available
    await page.evaluate(() => {
      if ((global as any).gc) {
        (global as any).gc();
      }
    });

    const finalMetrics = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Memory increase should be minimal (< 10MB)
    const memoryIncrease = finalMetrics - initialMetrics;
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});

function generateLargeFileTree(count: number) {
  const tree: any = {
    name: 'root',
    type: 'folder',
    children: []
  };

  for (let i = 0; i < count; i++) {
    tree.children.push({
      name: `file${i}.js`,
      type: 'file',
      size: 1024
    });
  }

  return tree;
}
```

## 6. Security Testing Strategy

### 6.1 Authentication Security Tests

```typescript
// tests/security/auth-security.test.ts
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../../tests/helpers/test-app';

describe('Authentication Security', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should prevent SQL injection in login', async () => {
    const maliciousPayload = {
      username: "admin' OR '1'='1",
      password: "password' OR '1'='1"
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(maliciousPayload)
      .expect(401);

    expect(response.body.error).toBe('Invalid credentials');
  });

  it('should hash passwords securely', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'secureuser',
        password: 'SecurePassword123!'
      })
      .expect(201);

    // Verify password is not stored in plain text
    const user = await app.db.users.findOne({ username: 'secureuser' });
    expect(user.password).not.toBe('SecurePassword123!');
    expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt format
  });

  it('should prevent timing attacks on login', async () => {
    const validUsername = 'testuser';
    const invalidUsername = 'nonexistent';

    // Measure time for valid username
    const start1 = Date.now();
    await request(app)
      .post('/api/auth/login')
      .send({ username: validUsername, password: 'wrongpass' });
    const time1 = Date.now() - start1;

    // Measure time for invalid username
    const start2 = Date.now();
    await request(app)
      .post('/api/auth/login')
      .send({ username: invalidUsername, password: 'wrongpass' });
    const time2 = Date.now() - start2;

    // Times should be similar (within 50ms)
    expect(Math.abs(time1 - time2)).toBeLessThan(50);
  });

  it('should enforce rate limiting on login attempts', async () => {
    const attempts = [];

    // Make 20 rapid login attempts
    for (let i = 0; i < 20; i++) {
      attempts.push(
        request(app)
          .post('/api/auth/login')
          .send({ username: 'test', password: 'test' })
      );
    }

    const responses = await Promise.all(attempts);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should invalidate JWT on logout', async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });

    const token = loginRes.body.token;

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Try to use token after logout
    await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('should enforce password complexity requirements', async () => {
    const weakPasswords = [
      'password',
      '12345678',
      'qwerty',
      'abcdefgh'
    ];

    for (const password of weakPasswords) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: `user${password}`,
          password
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'password',
          message: expect.stringContaining('complexity')
        })
      );
    }
  });

  it('should prevent JWT tampering', async () => {
    // Get valid token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });

    const validToken = loginRes.body.token;

    // Tamper with token
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({
      userId: 'admin',
      role: 'admin'
    })).toString('base64');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    // Try to use tampered token
    await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .expect(401);
  });

  it('should enforce token expiration', async () => {
    // Create token with short expiry
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpass',
        expiresIn: '1s' // 1 second
      });

    const token = loginRes.body.token;

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to use expired token
    await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
```

### 6.2 Input Validation and Sanitization Tests

```typescript
// tests/security/input-validation.test.ts
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../../tests/helpers/test-app';

describe('Input Validation and Sanitization', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });
    authToken = loginRes.body.token;
  });

  it('should prevent XSS in project names', async () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>'
    ];

    for (const payload of xssPayloads) {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: payload,
          type: 'claude-code'
        })
        .expect(201);

      // Verify sanitization
      expect(response.body.name).not.toContain('<script');
      expect(response.body.name).not.toContain('javascript:');
    }
  });

  it('should prevent path traversal in file operations', async () => {
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Path Test', type: 'claude-code' });

    const projectId = projectRes.body.id;

    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '/etc/shadow',
      'C:\\Windows\\System32\\config\\SAM'
    ];

    for (const path of maliciousPaths) {
      await request(app)
        .get(`/api/projects/${projectId}/files/${encodeURIComponent(path)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    }
  });

  it('should prevent command injection in Claude wrapper', async () => {
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Command Test', type: 'claude-code' });

    const projectId = projectRes.body.id;

    const injectionPayloads = [
      'test; rm -rf /',
      'test && cat /etc/passwd',
      'test || whoami',
      'test | ls -la',
      'test `cat /etc/passwd`',
      'test $(rm -rf /)'
    ];

    for (const payload of injectionPayloads) {
      const response = await request(app)
        .post(`/api/projects/${projectId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'code',
          args: ['--prompt', payload]
        });

      // Should either reject or sanitize
      expect([400, 422]).toContain(response.status);
    }
  });

  it('should validate file size limits', async () => {
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Size Test', type: 'claude-code' });

    const projectId = projectRes.body.id;

    // Try to upload file larger than limit (100MB)
    const largeContent = 'a'.repeat(101 * 1024 * 1024); // 101MB

    await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        path: 'large.txt',
        content: largeContent
      })
      .expect(413); // Payload Too Large
  });

  it('should validate JSON payload structure', async () => {
    const malformedPayloads = [
      '{ invalid json }',
      '{ "name": }',
      '{ "type": "unknown" }',
      '{ "extra": "field", "name": "test" }'
    ];

    for (const payload of malformedPayloads) {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(400);
    }
  });

  it('should prevent NoSQL injection', async () => {
    const noSQLPayloads = [
      { username: { $ne: null }, password: { $ne: null } },
      { username: { $gt: '' }, password: { $gt: '' } },
      { username: 'admin', password: { $regex: '.*' } }
    ];

    for (const payload of noSQLPayloads) {
      await request(app)
        .post('/api/auth/login')
        .send(payload)
        .expect(401);
    }
  });

  it('should sanitize HTML in markdown content', async () => {
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Markdown Test', type: 'claude-code' });

    const projectId = projectRes.body.id;

    const maliciousMarkdown = `
      # Title
      <script>alert('XSS')</script>
      <img src=x onerror=alert('XSS')>
      [Click me](javascript:alert('XSS'))
    `;

    const response = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        path: 'README.md',
        content: maliciousMarkdown
      })
      .expect(201);

    // Retrieve and verify sanitization
    const fileRes = await request(app)
      .get(`/api/projects/${projectId}/files/README.md`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(fileRes.body.content).not.toContain('<script');
    expect(fileRes.body.content).not.toContain('onerror');
    expect(fileRes.body.content).not.toContain('javascript:');
  });
});
```

### 6.3 OWASP ZAP Security Scan

```yaml
# tests/security/zap-scan.yaml
env:
  contexts:
    - name: Claude Dashboard
      urls:
        - http://localhost:5000
      includePaths:
        - "http://localhost:5000/api/.*"
      excludePaths:
        - "http://localhost:5000/api/health"
      authentication:
        method: "json"
        parameters:
          loginUrl: "http://localhost:5000/api/auth/login"
          loginRequestData: '{"username":"testuser","password":"testpass123"}'
        verification:
          method: "response"
          loggedInRegex: "\\Qtoken\\E"

jobs:
  - type: passiveScan-config
    parameters:
      maxAlertsPerRule: 10

  - type: spider
    parameters:
      context: Claude Dashboard
      user: testuser
      maxDuration: 5

  - type: activeScan
    parameters:
      context: Claude Dashboard
      user: testuser
      maxRuleDurationInMins: 5
      maxScanDurationInMins: 20

  - type: report
    parameters:
      template: traditional-html
      reportDir: /zap/reports
      reportFile: security-report.html
      reportTitle: Claude Dashboard Security Scan
```

## 7. Accessibility Testing Strategy

### 7.1 Automated A11y Tests

```typescript
// tests/a11y/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
  });

  test('login page should be accessible', async ({ page }) => {
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('dashboard should be accessible', async ({ page }) => {
    // Login first
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    await injectAxe(page);
    await checkA11y(page);
  });

  test('file browser should be accessible', async ({ page }) => {
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    await page.click('text=Test Project');
    await page.waitForSelector('[data-testid=file-browser]');

    await injectAxe(page);
    await checkA11y(page, '[data-testid=file-browser]');
  });

  test('forms should have proper labels', async ({ page }) => {
    await page.click('text=New Project');

    const violations = await getViolations(page, null, {
      rules: {
        'label': { enabled: true }
      }
    });

    expect(violations).toHaveLength(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab');
    let focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('INPUT'); // Username field

    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('INPUT'); // Password field

    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('BUTTON'); // Submit button
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    // Check for ARIA landmarks
    const main = await page.locator('[role=main]').count();
    expect(main).toBeGreaterThan(0);

    const navigation = await page.locator('[role=navigation]').count();
    expect(navigation).toBeGreaterThan(0);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await injectAxe(page);

    const violations = await getViolations(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    expect(violations).toHaveLength(0);
  });

  test('images should have alt text', async ({ page }) => {
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    const violations = await getViolations(page, null, {
      rules: {
        'image-alt': { enabled: true }
      }
    });

    expect(violations).toHaveLength(0);
  });

  test('should support screen reader announcements', async ({ page }) => {
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');

    // Check for live region
    const liveRegion = await page.locator('[aria-live]').count();
    expect(liveRegion).toBeGreaterThan(0);
  });

  test('modals should trap focus', async ({ page }) => {
    await page.fill('[name=username]', 'testuser');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');

    // Open modal
    await page.click('text=New Project');
    await page.waitForSelector('[role=dialog]');

    // Try to tab outside modal
    const modalElements = await page.locator('[role=dialog] button, [role=dialog] input').count();

    for (let i = 0; i < modalElements + 2; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should still be within modal
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.closest('[role=dialog]') !== null;
    });

    expect(focusedElement).toBe(true);
  });
});
```

### 7.2 Manual A11y Testing Checklist

```markdown
# Manual Accessibility Testing Checklist

## Keyboard Navigation
- [ ] All interactive elements accessible via Tab
- [ ] Tab order is logical
- [ ] No keyboard traps
- [ ] Skip links available
- [ ] Focus indicators visible
- [ ] Escape key closes modals
- [ ] Arrow keys navigate lists/menus

## Screen Reader Testing
- [ ] All content announced correctly
- [ ] Form labels properly associated
- [ ] Error messages announced
- [ ] Status changes announced
- [ ] Headings properly structured (H1-H6)
- [ ] Landmarks properly labeled
- [ ] Alt text for images descriptive

## Visual Testing
- [ ] Text readable at 200% zoom
- [ ] No horizontal scrolling at 320px width
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] No color-only indicators
- [ ] Focus indicators visible
- [ ] Text spacing adjustable

## Motor Disabilities
- [ ] Click targets at least 44x44px
- [ ] No tight timing requirements
- [ ] Drag operations have alternatives
- [ ] Gestures have keyboard alternatives

## Cognitive Disabilities
- [ ] Clear error messages
- [ ] Consistent navigation
- [ ] Simple language used
- [ ] No flashing content
- [ ] Adequate time to read content

## Testing Tools
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)
- axe DevTools
- WAVE
- Lighthouse
```

## 8. CI/CD Pipeline Integration

### 8.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: 18
  POSTGRES_VERSION: 15
  REDIS_VERSION: 7

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: claude_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run backend unit tests
        run: npm run test:backend:unit
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/claude_test
          REDIS_URL: redis://localhost:6379

      - name: Run frontend unit tests
        run: npm run test:frontend:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/backend/coverage-final.json,./coverage/frontend/coverage-final.json
          flags: unittests
          name: codecov-umbrella

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: claude_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/claude_test

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/claude_test
          REDIS_URL: redis://localhost:6379

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: integration-test-results
          path: test-results/

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: integration-tests

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Start application
        run: |
          npm run start:test &
          npx wait-on http://localhost:5000
        env:
          NODE_ENV: test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    needs: e2e-tests

    steps:
      - uses: actions/checkout@v3

      - name: Setup k6
        run: |
          curl -L https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar xvz
          sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: Run load tests
        run: k6 run tests/performance/load-test.js

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: k6-results/

  security-tests:
    name: Security Tests
    runs-on: ubuntu-latest
    needs: integration-tests

    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: OWASP ZAP Scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'http://localhost:5000'
          rules_file_name: 'tests/security/zap-rules.conf'
          cmd_options: '-a'

      - name: Upload ZAP report
        uses: actions/upload-artifact@v3
        with:
          name: zap-report
          path: zap-report/

  accessibility-tests:
    name: Accessibility Tests
    runs-on: ubuntu-latest
    needs: e2e-tests

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: npm ci

      - name: Start application
        run: |
          npm run start:test &
          npx wait-on http://localhost:5000

      - name: Run accessibility tests
        run: npm run test:a11y

      - name: Upload a11y results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: a11y-report
          path: a11y-report/

  quality-gates:
    name: Quality Gates
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests, security-tests, accessibility-tests]

    steps:
      - uses: actions/checkout@v3

      - name: Check code coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80%"
            exit 1
          fi

      - name: Check test results
        run: |
          if [ -f test-failures.txt ]; then
            echo "Tests failed"
            exit 1
          fi

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### 8.2 Test Configuration Files

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'tests/**'
      ],
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    },
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
});
```

```javascript
// jest.config.js (for backend)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.mock.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%',
};
```

## 9. Test Data Generation

### 9.1 Factory Pattern for Test Data

```typescript
// tests/factories/project.factory.ts
import { faker } from '@faker-js/faker';
import { Project, ProjectType } from '../../backend/src/entities/Project';

export class ProjectFactory {
  static create(overrides?: Partial<Project>): Project {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      type: faker.helpers.arrayElement(['claude-code', 'claude-b'] as ProjectType[]),
      path: faker.system.directoryPath(),
      status: 'inactive',
      userId: faker.string.uuid(),
      description: faker.lorem.sentence(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createMany(count: number, overrides?: Partial<Project>): Project[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createActiveProject(overrides?: Partial<Project>): Project {
    return this.create({
      status: 'active',
      ...overrides
    });
  }

  static createWithFiles(overrides?: Partial<Project>): Project {
    const project = this.create(overrides);
    // Add file structure
    return project;
  }
}
```

```typescript
// tests/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import { User } from '../../backend/src/entities/User';
import bcrypt from 'bcrypt';

export class UserFactory {
  static async create(overrides?: Partial<User>): Promise<User> {
    const password = overrides?.password || 'Test123!@#';
    const passwordHash = await bcrypt.hash(password, 10);

    return {
      id: faker.string.uuid(),
      username: faker.internet.userName(),
      email: faker.internet.email(),
      passwordHash,
      apiKeys: {
        anthropic: faker.string.alphanumeric(32),
        openai: faker.string.alphanumeric(32),
        speechmatics: faker.string.alphanumeric(32)
      },
      preferences: {
        theme: 'light',
        notifications: true
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static async createMany(count: number, overrides?: Partial<User>): Promise<User[]> {
    return Promise.all(
      Array.from({ length: count }, () => this.create(overrides))
    );
  }
}
```

### 9.2 Database Seeding for Tests

```typescript
// tests/helpers/seed-database.ts
import { DataSource } from 'typeorm';
import { UserFactory } from '../factories/user.factory';
import { ProjectFactory } from '../factories/project.factory';

export class DatabaseSeeder {
  constructor(private dataSource: DataSource) {}

  async seed() {
    // Clear existing data
    await this.clear();

    // Seed users
    const users = await UserFactory.createMany(10);
    await this.dataSource.getRepository('User').save(users);

    // Seed projects for each user
    for (const user of users) {
      const projects = ProjectFactory.createMany(5, { userId: user.id });
      await this.dataSource.getRepository('Project').save(projects);
    }

    return { users, projects };
  }

  async clear() {
    const entities = this.dataSource.entityMetadatas;

    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.clear();
    }
  }
}
```

## 10. Quality Gates and Acceptance Criteria

### 10.1 Automated Quality Gates

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  quality-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Check code coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"

          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "::error::Coverage $COVERAGE% is below minimum 80%"
            exit 1
          fi

      - name: Check test results
        run: |
          TOTAL_TESTS=$(cat test-results/summary.json | jq '.numTotalTests')
          FAILED_TESTS=$(cat test-results/summary.json | jq '.numFailedTests')

          echo "Total tests: $TOTAL_TESTS"
          echo "Failed tests: $FAILED_TESTS"

          if [ $FAILED_TESTS -gt 0 ]; then
            echo "::error::$FAILED_TESTS tests failed"
            exit 1
          fi

      - name: Check performance benchmarks
        run: |
          P95=$(cat k6-results/summary.json | jq '.metrics.http_req_duration.values.p95')

          if (( $(echo "$P95 > 500" | bc -l) )); then
            echo "::error::P95 response time $P95ms exceeds 500ms threshold"
            exit 1
          fi

      - name: Check security vulnerabilities
        run: |
          CRITICAL=$(cat snyk-results.json | jq '.vulnerabilities | map(select(.severity=="critical")) | length')
          HIGH=$(cat snyk-results.json | jq '.vulnerabilities | map(select(.severity=="high")) | length')

          if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 0 ]; then
            echo "::error::Found $CRITICAL critical and $HIGH high severity vulnerabilities"
            exit 1
          fi

      - name: Check accessibility violations
        run: |
          VIOLATIONS=$(cat a11y-report/summary.json | jq '.violations | length')

          if [ $VIOLATIONS -gt 0 ]; then
            echo "::warning::Found $VIOLATIONS accessibility violations"
          fi
```

### 10.2 Acceptance Criteria Checklist

```markdown
# Test Acceptance Criteria

## Code Coverage
- [ ] Overall line coverage ≥ 85%
- [ ] Branch coverage ≥ 80%
- [ ] Function coverage ≥ 85%
- [ ] Critical paths have 100% coverage

## Test Execution
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No flaky tests (tests pass consistently)

## Performance
- [ ] API response time p95 < 500ms
- [ ] Frontend load time < 3s
- [ ] File browser renders 1000 files in < 500ms
- [ ] No memory leaks detected

## Security
- [ ] No critical or high severity vulnerabilities
- [ ] All inputs properly validated
- [ ] All outputs properly sanitized
- [ ] Authentication/authorization working correctly
- [ ] OWASP ZAP scan passes

## Accessibility
- [ ] WCAG 2.1 Level AA compliance
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast meets standards
- [ ] No critical axe violations

## Cross-browser Compatibility
- [ ] Tests pass in Chrome
- [ ] Tests pass in Firefox
- [ ] Tests pass in Safari
- [ ] Tests pass in Edge
- [ ] Mobile responsive

## Documentation
- [ ] All tests documented
- [ ] Test coverage reports generated
- [ ] Failed test screenshots captured
- [ ] Performance benchmarks recorded
```

## Summary

This comprehensive testing strategy provides:

1. **Framework Recommendations**: Vitest, Playwright, Jest, k6, axe-core
2. **Coverage Requirements**: >80% across all metrics
3. **Unit Testing**: Component, service, and repository layers
4. **Integration Testing**: API, CLI wrapper, WebSocket
5. **E2E Testing**: Complete user workflows
6. **Voice Testing**: Transcription and input validation
7. **Performance Testing**: Load testing and benchmarking
8. **Security Testing**: Input validation, authentication, OWASP
9. **Accessibility Testing**: WCAG compliance and screen reader support
10. **CI/CD Integration**: Automated pipeline with quality gates

**Next Steps:**
1. Set up testing frameworks
2. Implement test infrastructure
3. Create test factories and helpers
4. Write initial test suites
5. Configure CI/CD pipeline
6. Establish monitoring and reporting
