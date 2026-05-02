# Claude Dashboard Architecture Document

## Executive Summary

Claude Dashboard is a comprehensive web-based GUI wrapper for Claude Code, Claude-B (`cb`), and arbitrary tmux-attached interactive CLI tools, providing an intuitive interface for AI-assisted development with project management, voice input, and automation capabilities.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React SPA)                     │
├─────────────────────────────────────────────────────────────┤
│                    WebSocket Gateway                         │
├─────────────────────────────────────────────────────────────┤
│                     API Gateway (REST)                       │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   Auth       │   Project    │   Claude     │   Voice       │
│   Service    │   Manager    │   Wrapper    │   Service     │
├──────────────┼──────────────┼──────────────┼───────────────┤
│              │              │   Process    │  Speechmatics │
│   Redis      │   PostgreSQL │   Manager    │     API       │
│              │              │              │               │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

## Component Specifications

### 1. Frontend Layer

#### Technology Stack
- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand + React Query
- **UI Library**: Tailwind CSS + shadcn/ui
- **Real-time**: Socket.io-client
- **Code Editor**: Monaco Editor
- **File Explorer**: React-arborist
- **Charts**: Recharts
- **Voice**: Web Audio API + MediaRecorder

#### Key Components

##### Dashboard Layout
```typescript
interface DashboardLayout {
  sidebar: ProjectNavigator;
  mainArea: WorkspaceView;
  statusBar: SystemStatus;
  commandPalette: CommandInterface;
}
```

##### Project Workspace
- Split-pane interface with resizable panels
- File browser with tree view
- Markdown preview with syntax highlighting
- Terminal emulator
- Task list with progress indicators

##### Prompt Interface
- Rich text editor with syntax highlighting
- Voice input button with real-time transcription
- Prompt enrichment panel
- Template selector
- Context attachments (files, previous outputs)

### 2. Backend Services

#### API Gateway (Node.js + Express)
```javascript
// Core endpoints
POST   /api/auth/login
GET    /api/projects
POST   /api/projects/create
GET    /api/projects/:id
POST   /api/claude/code/execute
POST   /api/claude/flow/execute
POST   /api/prompt/enrich
POST   /api/voice/transcribe
GET    /api/infrastructure/:projectId
WS     /ws/logs/:sessionId
```

#### Authentication Service
- **Method**: JWT with refresh tokens
- **Storage**: Redis for session management
- **Security**: bcrypt for password hashing
- **2FA**: Optional TOTP support

```javascript
interface User {
  id: string;
  username: string;
  passwordHash: string;
  apiKeys: {
    anthropic?: string;
    openai?: string;
    speechmatics?: string;
  };
  preferences: UserPreferences;
}
```

#### Project Manager Service
- **Database**: PostgreSQL with TypeORM
- **File Storage**: Local filesystem with S3 option
- **Version Control**: Git integration

```javascript
interface Project {
  id: string;
  name: string;
  type: 'claude-code' | 'claude-b';
  path: string;
  status: ProjectStatus;
  infrastructure: Infrastructure[];
  metadata: ProjectMetadata;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Claude Wrapper Service
- **Process Management**: Node.js child_process
- **Queue System**: Bull queue with Redis
- **Session Management**: Concurrent session handling

```javascript
class ClaudeWrapper {
  executeCommand(command: string, args: string[]): Observable<Output>
  startSession(projectId: string, type: ClaudeType): Session
  stopSession(sessionId: string): void
  getSessionLogs(sessionId: string): LogStream
}
```

#### Voice Processing Service
```javascript
interface VoiceService {
  transcribe(audio: Buffer): Promise<Transcript>
  enhance(text: string, provider: 'openai' | 'anthropic'): Promise<EnhancedPrompt>
}
```

### 3. Infrastructure Layer

#### Docker Configuration
```yaml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  
  backend:
    build: ./backend
    ports: ["5000:5000"]
    volumes:
      - ./projects:/app/projects
      - /var/run/docker.sock:/var/run/docker.sock
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: claude_dashboard
  
  redis:
    image: redis:7-alpine
```

#### Process Management
- **Supervisor**: PM2 for Node.js processes
- **Container Management**: Docker SDK for project containers
- **Resource Limits**: CPU and memory quotas per project

### 4. Data Models

#### Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  path TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  command TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  output TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  original_text TEXT NOT NULL,
  enriched_text TEXT,
  voice_input BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Security Considerations

#### Authentication & Authorization
- JWT tokens with 15-minute expiry
- Refresh tokens with 7-day expiry
- Rate limiting on all endpoints
- CORS configuration for production

#### Data Protection
- Encryption at rest for sensitive data
- TLS 1.3 for all communications
- API key encryption in database
- Audit logging for all actions

#### Input Validation
- Sanitization of all user inputs
- Command injection prevention
- Path traversal protection
- SQL injection prevention via parameterized queries

### 6. Scheduler System

#### Architecture
```javascript
class QuotaScheduler {
  private queue: Bull.Queue;
  private quotaTracker: QuotaTracker;
  
  scheduleTask(task: Task): Promise<ScheduledTask>
  pauseOnQuotaExceeded(): void
  resumeWhenAvailable(): void
  getQueueStatus(): QueueStatus
}
```

#### Features
- Automatic pause/resume based on API quotas
- Priority queue for critical tasks
- Retry mechanism with exponential backoff
- Dead letter queue for failed tasks

### 7. Real-time Communication

#### WebSocket Events
```javascript
// Server -> Client
'project:status': ProjectStatus
'task:progress': TaskProgress
'log:stream': LogEntry
'infrastructure:update': InfrastructureChange

// Client -> Server
'project:start': StartProjectCommand
'task:execute': ExecuteTaskCommand
'session:terminate': TerminateSessionCommand
```

### 8. Monitoring & Analytics

#### Metrics Collection
- Prometheus metrics for system monitoring
- Custom metrics for AI API usage
- Project-level resource tracking
- User activity analytics

#### Dashboard Metrics
```javascript
interface Metrics {
  apiUsage: {
    anthropic: UsageStats;
    openai: UsageStats;
    speechmatics: UsageStats;
  };
  projectStats: {
    active: number;
    total: number;
    byType: Record<string, number>;
  };
  systemHealth: {
    cpu: number;
    memory: number;
    disk: number;
  };
}
```

## Deployment Architecture

### Production Setup
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CloudFlare │────▶│   Load       │────▶│   Nginx      │
│     CDN      │     │   Balancer   │     │   Reverse    │
└──────────────┘     └──────────────┘     │   Proxy      │
                                           └──────┬───────┘
                                                  │
                            ┌─────────────────────┼─────────────────────┐
                            │                     │                     │
                    ┌───────▼──────┐    ┌────────▼──────┐    ┌─────────▼──────┐
                    │   Frontend    │    │   Backend     │    │   WebSocket    │
                    │   (React)     │    │   API         │    │   Gateway      │
                    └───────────────┘    └───────┬───────┘    └────────────────┘
                                                  │
                                     ┌────────────┼────────────┐
                                     │            │            │
                            ┌────────▼───┐ ┌─────▼────┐ ┌─────▼────┐
                            │  PostgreSQL│ │  Redis   │ │  Docker  │
                            └────────────┘ └──────────┘ └──────────┘
```

### Scaling Strategy
1. **Horizontal Scaling**: Multiple backend instances behind load balancer
2. **Database Replication**: Read replicas for PostgreSQL
3. **Cache Layer**: Redis cluster for session and cache data
4. **CDN**: Static assets served via CloudFlare
5. **Auto-scaling**: Kubernetes HPA for dynamic scaling

## Performance Requirements

### Response Times
- API endpoints: < 200ms (p95)
- WebSocket latency: < 50ms
- File browser: < 100ms for 1000 files
- Voice transcription: < 2s for 30s audio

### Capacity
- Concurrent users: 100+
- Active projects: 1000+
- WebSocket connections: 500+
- File size limit: 100MB per file

## Integration Points

### External APIs
1. **Anthropic API**: Claude completions
2. **OpenAI API**: GPT-4 for prompt enrichment
3. **Speechmatics API**: Voice transcription
4. **GitHub API**: Repository integration
5. **Docker API**: Container management

### CLI Tools
1. **Claude Code**: Direct CLI invocation
2. **Claude-B (`cb`)**: Background-agent daemon REST API + WS streaming
3. **tmux**: Live attachment to host sessions (capture-pane + send-keys)
4. **Git**: Version control operations
5. **Docker**: Container operations

## Development Roadmap

### Phase 1: Core Foundation (Weeks 1-4)
- Basic authentication system
- Project creation and management
- Claude CLI wrapper implementation
- File browser with basic operations

### Phase 2: Intelligence Layer (Weeks 5-8)
- Prompt enrichment integration
- Voice input with Speechmatics
- Template system
- Context management

### Phase 3: Advanced Features (Weeks 9-12)
- Real-time log streaming
- Infrastructure visualization
- Scheduler implementation
- Analytics dashboard

### Phase 4: Polish & Production (Weeks 13-16)
- Performance optimization
- Security hardening
- Documentation
- Deployment automation

## Testing Strategy

### Unit Testing
- Jest for JavaScript/TypeScript
- 80% code coverage target
- Mocking for external services

### Integration Testing
- API endpoint testing
- WebSocket communication testing
- CLI wrapper testing

### End-to-End Testing
- Playwright for UI testing
- Critical user flows coverage
- Cross-browser compatibility

### Performance Testing
- Load testing with k6
- Stress testing for concurrent users
- Memory leak detection

## Documentation Requirements

### User Documentation
- Getting started guide
- Feature documentation
- Video tutorials
- FAQ section

### Developer Documentation
- API documentation (OpenAPI/Swagger)
- Architecture diagrams
- Deployment guide
- Contributing guidelines

## Success Metrics

### Technical KPIs
- System uptime: > 99.9%
- API response time: < 200ms (p95)
- Error rate: < 0.1%
- Test coverage: > 80%

### User KPIs
- Time to first project: < 5 minutes
- Daily active users growth
- Project completion rate
- User satisfaction score

## Risk Analysis

### Technical Risks
1. **CLI Integration Complexity**: Mitigation - Comprehensive wrapper testing
2. **Scaling Challenges**: Mitigation - Cloud-native architecture
3. **API Rate Limits**: Mitigation - Intelligent scheduler with queuing

### Security Risks
1. **Command Injection**: Mitigation - Input sanitization and sandboxing
2. **Data Exposure**: Mitigation - Encryption and access controls
3. **API Key Leakage**: Mitigation - Secure key management

## Conclusion

This architecture provides a robust, scalable foundation for the Claude Dashboard, enabling seamless integration with Claude Code, Claude-B, and any tmux-attached interactive CLI while providing an intuitive user experience with advanced features for AI-assisted development.
