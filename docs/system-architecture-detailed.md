# Claude Dashboard - Comprehensive System Architecture
## SPARC Architecture Phase - Detailed Technical Design

**Version**: 1.0
**Date**: 2025-10-05
**Architect**: Hive Mind Architecture Agent
**Status**: Design Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Component Architecture](#component-architecture)
4. [Data Architecture](#data-architecture)
5. [Communication Architecture](#communication-architecture)
6. [Security Architecture](#security-architecture)
7. [Infrastructure Architecture](#infrastructure-architecture)
8. [Scalability Design](#scalability-design)
9. [Technology Stack Justification](#technology-stack-justification)
10. [Architecture Decision Records](#architecture-decision-records)

---

## Executive Summary

Claude Dashboard is a sophisticated web-based GUI wrapper for Claude Code and Claude Flow CLI tools. The architecture prioritizes:

- **Modularity**: Clean separation between frontend, backend, and services
- **Maintainability**: Clear interfaces and dependency boundaries
- **Scalability**: Horizontal scaling with stateless services
- **Security**: Multi-layer security with encryption and authentication
- **Extensibility**: Plugin-based architecture for future enhancements

### Key Architectural Principles

1. **Separation of Concerns**: Each layer has a single, well-defined responsibility
2. **API-First Design**: RESTful APIs with comprehensive OpenAPI documentation
3. **Event-Driven Architecture**: Asynchronous processing for long-running tasks
4. **Stateless Services**: All application state in databases/cache
5. **Defense in Depth**: Security at every layer

---

## System Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                      │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│   Web Browser        │   Voice Input        │   WebSocket Client            │
│   (React SPA)        │   (MediaRecorder)    │   (Socket.io)                 │
└──────────┬───────────┴──────────┬───────────┴────────────┬──────────────────┘
           │                      │                         │
           │ HTTPS                │ HTTPS                   │ WSS
           │                      │                         │
┌──────────▼──────────────────────▼─────────────────────────▼──────────────────┐
│                         API GATEWAY LAYER                                     │
├───────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Nginx     │  │ Rate Limiter │  │   CORS       │  │   Auth       │      │
│  │   Reverse   │  │   (Redis)    │  │   Filter     │  │   Filter     │      │
│  │   Proxy     │  │              │  │              │  │   (JWT)      │      │
│  └─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────────────┐
│                        APPLICATION LAYER                                      │
├─────────────┬──────────────┬──────────────┬──────────────┬───────────────────┤
│             │              │              │              │                   │
│  ┌──────────▼─────────┐ ┌─▼───────────┐ ┌▼──────────┐  │ ┌────────────────┐│
│  │  Auth Service      │ │  Project    │ │  Claude   │  │ │  Voice         ││
│  │  - JWT Management  │ │  Manager    │ │  Wrapper  │  │ │  Processing    ││
│  │  - User Management │ │  - CRUD     │ │  Service  │  │ │  Service       ││
│  │  - Session Store   │ │  - Files    │ │  - CLI    │  │ │  - Transcribe  ││
│  └────────────────────┘ │  - Git      │ │  - Process│  │ │  - Enhance     ││
│                         └─────────────┘ │  - Queue  │  │ └────────────────┘│
│  ┌────────────────────┐                 └───────────┘  │                   ││
│  │  Scheduler         │ ┌──────────────┐               │ ┌────────────────┐│
│  │  Service           │ │  Analytics   │               │ │  Notification  ││
│  │  - Quota Mgmt      │ │  Service     │               │ │  Service       ││
│  │  - Task Queue      │ │  - Metrics   │               │ │  - Events      ││
│  │  - Retry Logic     │ │  - Logging   │               │ │  - WebSocket   ││
│  └────────────────────┘ └──────────────┘               │ └────────────────┘│
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────────────┐
│                          DATA LAYER                                           │
├─────────────┬──────────────┬──────────────┬──────────────┬───────────────────┤
│             │              │              │              │                   │
│  ┌──────────▼─────────┐ ┌─▼───────────┐ ┌▼──────────┐  │ ┌────────────────┐│
│  │  PostgreSQL        │ │  Redis      │ │  S3/Minio │  │ │  RabbitMQ      ││
│  │  - Users           │ │  - Sessions │ │  - Files  │  │ │  - Task Queue  ││
│  │  - Projects        │ │  - Cache    │ │  - Logs   │  │ │  - Events      ││
│  │  - Sessions        │ │  - Quotas   │ │  - Backups│  │ │  - Pub/Sub     ││
│  │  - Tasks           │ └─────────────┘ └───────────┘  │ └────────────────┘│
│  │  - Audit Logs      │                                │                   ││
│  └────────────────────┘                                │                   ││
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES LAYER                                │
├─────────────┬──────────────┬──────────────┬──────────────┬───────────────────┤
│  Anthropic  │   OpenAI     │  Speechmatics│   GitHub     │   Docker         │
│  API        │   API        │  API         │   API        │   Engine         │
└─────────────┴──────────────┴──────────────┴──────────────┴───────────────────┘
```

### Layer Responsibilities

#### 1. Client Layer
- **Purpose**: User interface and interaction
- **Components**: React SPA, WebSocket client, voice recorder
- **Responsibilities**:
  - Render UI components
  - Manage client-side state
  - Handle user input
  - Real-time updates via WebSocket
  - Local validation

#### 2. API Gateway Layer
- **Purpose**: Request routing, filtering, and security
- **Components**: Nginx, rate limiters, auth filters
- **Responsibilities**:
  - Load balancing
  - SSL/TLS termination
  - Request routing
  - Rate limiting
  - CORS handling
  - JWT validation

#### 3. Application Layer
- **Purpose**: Business logic and orchestration
- **Components**: Microservices for specific domains
- **Responsibilities**:
  - Business logic execution
  - Service orchestration
  - Data transformation
  - External API integration
  - Event emission

#### 4. Data Layer
- **Purpose**: Data persistence and caching
- **Components**: PostgreSQL, Redis, S3, RabbitMQ
- **Responsibilities**:
  - Data storage
  - Caching
  - Message queuing
  - Session management
  - File storage

---

## Component Architecture

### 1. Frontend Architecture

#### Component Hierarchy

```
App
├── AuthProvider
│   ├── LoginPage
│   └── ProtectedRoutes
│       ├── DashboardLayout
│       │   ├── Sidebar
│       │   │   ├── ProjectNavigator
│       │   │   └── QuickActions
│       │   ├── Header
│       │   │   ├── UserMenu
│       │   │   ├── Notifications
│       │   │   └── Settings
│       │   ├── MainContent
│       │   │   ├── ProjectDashboard
│       │   │   ├── WorkspaceView
│       │   │   │   ├── FileBrowser
│       │   │   │   ├── CodeEditor
│       │   │   │   └── TerminalEmulator
│       │   │   ├── InfrastructureView
│       │   │   │   ├── ContainerList
│       │   │   │   ├── ResourceMonitor
│       │   │   │   └── NetworkTopology
│       │   │   ├── PromptBuilder
│       │   │   │   ├── VoiceInput
│       │   │   │   ├── PromptEditor
│       │   │   │   └── EnhancementPanel
│       │   │   └── AnalyticsDashboard
│       │   │       ├── UsageCharts
│       │   │       ├── QuotaDisplay
│       │   │       └── CostAnalysis
│       │   └── StatusBar
│       └── Modals
│           ├── CreateProjectModal
│           ├── SettingsModal
│           └── ConfirmationModal
└── ErrorBoundary
```

#### State Management Architecture

```typescript
// Global State (Zustand)
interface GlobalState {
  auth: AuthState;
  ui: UIState;
  notifications: NotificationState;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeProject: string | null;
  commandPaletteOpen: boolean;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

// Server State (React Query)
interface ServerState {
  projects: UseQueryResult<Project[]>;
  sessions: UseQueryResult<Session[]>;
  containers: UseQueryResult<Container[]>;
  quotas: UseQueryResult<Quota[]>;
}
```

#### Component Design Pattern

```typescript
// Example: Feature-based component structure
// components/ProjectWorkspace/index.tsx

interface ProjectWorkspaceProps {
  projectId: string;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ projectId }) => {
  // Data fetching
  const { data: project, isLoading } = useProject(projectId);
  const { data: files } = useProjectFiles(projectId);

  // Local state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // WebSocket connection
  const { logs } = useWebSocketLogs(projectId);

  // Event handlers
  const handleFileSelect = useCallback((fileId: string) => {
    setSelectedFile(fileId);
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="workspace-container">
      <FileBrowser
        files={files}
        onSelect={handleFileSelect}
      />
      <CodeEditor
        file={selectedFile}
        projectId={projectId}
      />
      <Terminal
        logs={logs}
        projectId={projectId}
      />
    </div>
  );
};
```

### 2. Backend Service Architecture

#### Service Layer Pattern

```typescript
// Domain-Driven Design Structure

// 1. Entity Layer
interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  apiKeys: ApiKeys;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Repository Layer
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(user: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
}

// 3. Service Layer
class UserService {
  constructor(
    private userRepository: UserRepository,
    private encryptionService: EncryptionService,
    private emailService: EmailService
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    // Business logic
    const passwordHash = await this.encryptionService.hash(dto.password);
    const user = await this.userRepository.create({
      ...dto,
      passwordHash
    });

    await this.emailService.sendWelcomeEmail(user.email);

    return user;
  }

  async validateCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) return null;

    const isValid = await this.encryptionService.compare(password, user.passwordHash);
    return isValid ? user : null;
  }
}

// 4. Controller Layer
class UserController {
  constructor(private userService: UserService) {}

  @Post('/users')
  @ValidateBody(CreateUserSchema)
  async createUser(req: Request, res: Response) {
    try {
      const user = await this.userService.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
```

#### Claude Wrapper Service Design

```typescript
// Core CLI wrapper implementation
class ClaudeWrapperService {
  private processes: Map<string, ProcessInfo> = new Map();
  private eventBus: EventBus;
  private logService: LogService;

  constructor(
    eventBus: EventBus,
    logService: LogService,
    private queueService: QueueService
  ) {
    this.eventBus = eventBus;
    this.logService = logService;
  }

  /**
   * Execute Claude CLI command
   */
  async executeCommand(
    sessionId: string,
    command: ClaudeCommand,
    options: CommandOptions
  ): Promise<CommandResult> {
    // Validate command
    this.validateCommand(command);

    // Check if already running
    if (this.processes.has(sessionId)) {
      throw new Error('Session already has running process');
    }

    // Prepare environment
    const env = this.prepareEnvironment(options);

    // Spawn process
    const process = spawn(command.cli, command.args, {
      cwd: options.workingDirectory,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Store process info
    this.processes.set(sessionId, {
      process,
      command,
      startedAt: new Date(),
      status: 'running'
    });

    // Stream output
    this.setupOutputStreaming(sessionId, process);

    // Handle completion
    return this.handleProcessCompletion(sessionId, process);
  }

  /**
   * Stream output to WebSocket clients
   */
  private setupOutputStreaming(sessionId: string, process: ChildProcess): void {
    process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();

      // Log to database
      this.logService.writeLog(sessionId, {
        type: 'stdout',
        content: output,
        timestamp: new Date()
      });

      // Emit to WebSocket
      this.eventBus.emit('process:output', {
        sessionId,
        type: 'stdout',
        data: output
      });
    });

    process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();

      this.logService.writeLog(sessionId, {
        type: 'stderr',
        content: output,
        timestamp: new Date()
      });

      this.eventBus.emit('process:output', {
        sessionId,
        type: 'stderr',
        data: output
      });
    });
  }

  /**
   * Handle process completion
   */
  private async handleProcessCompletion(
    sessionId: string,
    process: ChildProcess
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      process.on('close', (code: number) => {
        const processInfo = this.processes.get(sessionId);

        if (processInfo) {
          processInfo.status = 'completed';
          processInfo.exitCode = code;
          processInfo.completedAt = new Date();
        }

        this.eventBus.emit('process:completed', {
          sessionId,
          exitCode: code,
          success: code === 0
        });

        this.processes.delete(sessionId);

        resolve({
          sessionId,
          exitCode: code,
          success: code === 0
        });
      });

      process.on('error', (error: Error) => {
        this.eventBus.emit('process:error', {
          sessionId,
          error: error.message
        });

        this.processes.delete(sessionId);
        reject(error);
      });
    });
  }

  /**
   * Terminate running process
   */
  async terminateSession(sessionId: string): Promise<void> {
    const processInfo = this.processes.get(sessionId);

    if (!processInfo) {
      throw new Error('No process found for session');
    }

    // Graceful shutdown
    processInfo.process.kill('SIGTERM');

    // Force kill after timeout
    setTimeout(() => {
      if (this.processes.has(sessionId)) {
        processInfo.process.kill('SIGKILL');
      }
    }, 5000);

    this.processes.delete(sessionId);
  }

  /**
   * Get process status
   */
  getProcessStatus(sessionId: string): ProcessStatus | null {
    const processInfo = this.processes.get(sessionId);

    if (!processInfo) return null;

    return {
      status: processInfo.status,
      startedAt: processInfo.startedAt,
      uptime: Date.now() - processInfo.startedAt.getTime()
    };
  }
}
```

### 3. Voice Processing Pipeline Architecture

```typescript
// Voice input processing workflow

class VoiceProcessingService {
  constructor(
    private speechmaticsClient: SpeechmaticsClient,
    private enhancementService: PromptEnhancementService,
    private storageService: StorageService
  ) {}

  /**
   * Complete voice-to-prompt pipeline
   */
  async processVoiceInput(
    audioBuffer: Buffer,
    userId: string,
    projectId?: string
  ): Promise<ProcessedPrompt> {
    // Step 1: Store original audio
    const audioId = await this.storageService.saveAudio(audioBuffer, userId);

    // Step 2: Transcribe audio
    const transcript = await this.transcribeAudio(audioBuffer);

    // Step 3: Clean and normalize transcript
    const normalizedText = this.normalizeTranscript(transcript);

    // Step 4: Extract context and intent
    const context = await this.extractContext(normalizedText, projectId);

    // Step 5: Enhance prompt with AI
    const enhancedPrompt = await this.enhancementService.enhance(
      normalizedText,
      context
    );

    // Step 6: Store processed prompt
    await this.storageService.savePrompt({
      userId,
      projectId,
      audioId,
      originalText: normalizedText,
      enhancedText: enhancedPrompt,
      context
    });

    return {
      original: normalizedText,
      enhanced: enhancedPrompt,
      context,
      audioId
    };
  }

  /**
   * Transcribe audio using Speechmatics
   */
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const result = await this.speechmaticsClient.transcribe({
      audio: audioBuffer,
      config: {
        language: 'en',
        operating_point: 'enhanced',
        enable_partials: false,
        punctuation_overrides: {
          permitted_marks: [',', '.', '?', '!']
        },
        diarization: 'none'
      }
    });

    return result.transcript;
  }

  /**
   * Normalize transcript (remove filler words, fix common errors)
   */
  private normalizeTranscript(transcript: string): string {
    let normalized = transcript;

    // Remove filler words
    const fillerWords = ['um', 'uh', 'like', 'you know', 'sort of'];
    fillerWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    });

    // Fix common transcription errors
    const corrections = {
      'rest api': 'REST API',
      'jason': 'JSON',
      'sql': 'SQL',
      'no js': 'Node.js'
    };

    Object.entries(corrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      normalized = normalized.replace(regex, correct);
    });

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Extract context from project if available
   */
  private async extractContext(
    text: string,
    projectId?: string
  ): Promise<PromptContext> {
    if (!projectId) {
      return { type: 'general' };
    }

    // Get project information
    const project = await this.projectService.getProject(projectId);

    // Get recent files and activity
    const recentFiles = await this.fileService.getRecentFiles(projectId, 5);
    const techStack = await this.detectTechStack(project);

    return {
      type: 'project',
      projectName: project.name,
      projectType: project.type,
      techStack,
      recentFiles: recentFiles.map(f => f.path)
    };
  }
}
```

---

## Data Architecture

### Database Schema Design

```sql
-- Users and Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  INDEX idx_users_username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_status (status)
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  key_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,

  UNIQUE(user_id, provider),
  INDEX idx_api_keys_user (user_id),
  INDEX idx_api_keys_provider (provider)
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('claude-code', 'claude-flow')),
  path TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  git_repository TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_projects_user (user_id),
  INDEX idx_projects_type (type),
  INDEX idx_projects_status (status),
  INDEX idx_projects_created (created_at DESC)
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  command TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  exit_code INTEGER,
  metadata JSONB,

  INDEX idx_sessions_project (project_id),
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_started (started_at DESC)
);

-- Tasks (for scheduler)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  priority INTEGER DEFAULT 0,
  command TEXT NOT NULL,
  args JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  output TEXT,
  error TEXT,
  metadata JSONB,

  INDEX idx_tasks_session (session_id),
  INDEX idx_tasks_project (project_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_scheduled (scheduled_at),
  INDEX idx_tasks_priority (priority DESC)
);

-- Prompts
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  audio_id UUID,
  original_text TEXT NOT NULL,
  enriched_text TEXT,
  voice_input BOOLEAN DEFAULT false,
  provider VARCHAR(50),
  context JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_prompts_user (user_id),
  INDEX idx_prompts_project (project_id),
  INDEX idx_prompts_created (created_at DESC),
  INDEX idx_prompts_voice (voice_input)
);

-- Logs
CREATE TABLE logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,

  INDEX idx_logs_session (session_id),
  INDEX idx_logs_timestamp (timestamp DESC)
) PARTITION BY RANGE (timestamp);

-- Log partitions (monthly)
CREATE TABLE logs_2025_10 PARTITION OF logs
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE logs_2025_11 PARTITION OF logs
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Infrastructure
CREATE TABLE containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  container_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  image VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  ports JSONB,
  environment JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,

  UNIQUE(container_id),
  INDEX idx_containers_project (project_id),
  INDEX idx_containers_status (status)
);

-- Quotas
CREATE TABLE quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  quota_type VARCHAR(50) NOT NULL,
  total_limit BIGINT NOT NULL,
  used_amount BIGINT DEFAULT 0,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, provider, quota_type),
  INDEX idx_quotas_user (user_id),
  INDEX idx_quotas_provider (provider),
  INDEX idx_quotas_reset (reset_at)
);

-- Audit Logs
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  request_data JSONB,
  response_status INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_resource (resource_type, resource_id),
  INDEX idx_audit_created (created_at DESC)
) PARTITION BY RANGE (created_at);

-- Audit log partitions (monthly)
CREATE TABLE audit_logs_2025_10 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

### Data Access Patterns

```typescript
// Repository pattern implementation

interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

class ProjectRepository implements BaseRepository<Project> {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Project | null> {
    return this.db.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    ).then(result => result.rows[0] || null);
  }

  async findByUser(userId: string, options?: QueryOptions): Promise<Project[]> {
    const { limit = 50, offset = 0, orderBy = 'updated_at', order = 'DESC' } = options || {};

    return this.db.query(
      `SELECT * FROM projects
       WHERE user_id = $1
       ORDER BY ${orderBy} ${order}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ).then(result => result.rows);
  }

  async findActiveByUser(userId: string): Promise<Project[]> {
    return this.db.query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM sessions s WHERE s.project_id = p.id AND s.status = 'running') as active_sessions
       FROM projects p
       WHERE p.user_id = $1 AND p.status = 'active'
       ORDER BY p.updated_at DESC`,
      [userId]
    ).then(result => result.rows);
  }

  async updateStatus(id: string, status: ProjectStatus): Promise<void> {
    await this.db.query(
      'UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );
  }
}
```

### Caching Strategy

```typescript
// Redis caching implementation

class CacheService {
  constructor(private redis: Redis) {}

  /**
   * Cache hierarchy:
   * L1: Application memory (for hot data)
   * L2: Redis (for distributed cache)
   * L3: Database (source of truth)
   */

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Cache keys naming convention
  getCacheKey(entity: string, id: string): string {
    return `${entity}:${id}`;
  }

  getUserCacheKey(userId: string): string {
    return this.getCacheKey('user', userId);
  }

  getProjectCacheKey(projectId: string): string {
    return this.getCacheKey('project', projectId);
  }

  getSessionCacheKey(sessionId: string): string {
    return this.getCacheKey('session', sessionId);
  }
}

// Usage in repository
class CachedProjectRepository extends ProjectRepository {
  constructor(
    db: Database,
    private cache: CacheService
  ) {
    super(db);
  }

  async findById(id: string): Promise<Project | null> {
    // Try cache first
    const cacheKey = this.cache.getProjectCacheKey(id);
    const cached = await this.cache.get<Project>(cacheKey);

    if (cached) {
      return cached;
    }

    // Cache miss - query database
    const project = await super.findById(id);

    if (project) {
      // Cache for 5 minutes
      await this.cache.set(cacheKey, project, 300);
    }

    return project;
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    const project = await super.update(id, data);

    // Invalidate cache
    const cacheKey = this.cache.getProjectCacheKey(id);
    await this.cache.invalidate(cacheKey);

    return project;
  }
}
```

---

## Communication Architecture

### REST API Design

```typescript
// OpenAPI 3.0 specification structure

/**
 * API Endpoint Organization:
 *
 * /api/v1/auth/*          - Authentication endpoints
 * /api/v1/users/*         - User management
 * /api/v1/projects/*      - Project CRUD
 * /api/v1/sessions/*      - Session management
 * /api/v1/tasks/*         - Task queue management
 * /api/v1/prompts/*       - Prompt operations
 * /api/v1/voice/*         - Voice processing
 * /api/v1/infrastructure/* - Container management
 * /api/v1/analytics/*     - Metrics and analytics
 */

// API Versioning Strategy
interface APIVersion {
  version: string; // v1, v2, etc.
  status: 'active' | 'deprecated' | 'sunset';
  sunsetDate?: Date;
}

// Request/Response format
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: ResponseMetadata;
}

interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface ResponseMetadata {
  requestId: string;
  timestamp: string;
  pagination?: PaginationInfo;
  rateLimitRemaining?: number;
}

// Example endpoint implementation
class ProjectsController {
  /**
   * GET /api/v1/projects
   * List all projects for authenticated user
   */
  @Get()
  @Authenticate()
  @RateLimit({ max: 100, window: '1m' })
  async listProjects(
    @Query() query: ListProjectsQuery,
    @User() user: AuthUser
  ): Promise<APIResponse<Project[]>> {
    const { page = 1, limit = 20, type, status } = query;

    const projects = await this.projectService.listProjects(user.id, {
      page,
      limit,
      type,
      status
    });

    return {
      success: true,
      data: projects.items,
      metadata: {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total: projects.total,
          totalPages: Math.ceil(projects.total / limit)
        }
      }
    };
  }

  /**
   * POST /api/v1/projects
   * Create new project
   */
  @Post()
  @Authenticate()
  @ValidateBody(CreateProjectSchema)
  @RateLimit({ max: 10, window: '1h' })
  async createProject(
    @Body() body: CreateProjectDto,
    @User() user: AuthUser
  ): Promise<APIResponse<Project>> {
    try {
      const project = await this.projectService.createProject(user.id, body);

      return {
        success: true,
        data: project,
        metadata: {
          requestId: generateRequestId(),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.errors
        });
      }
      throw error;
    }
  }

  /**
   * GET /api/v1/projects/:id
   * Get project by ID
   */
  @Get(':id')
  @Authenticate()
  async getProject(
    @Param('id') id: string,
    @User() user: AuthUser
  ): Promise<APIResponse<Project>> {
    const project = await this.projectService.getProject(id, user.id);

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found'
      });
    }

    return {
      success: true,
      data: project,
      metadata: {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * PATCH /api/v1/projects/:id
   * Update project
   */
  @Patch(':id')
  @Authenticate()
  @ValidateBody(UpdateProjectSchema)
  async updateProject(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
    @User() user: AuthUser
  ): Promise<APIResponse<Project>> {
    const project = await this.projectService.updateProject(id, user.id, body);

    return {
      success: true,
      data: project,
      metadata: {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * DELETE /api/v1/projects/:id
   * Delete project
   */
  @Delete(':id')
  @Authenticate()
  async deleteProject(
    @Param('id') id: string,
    @User() user: AuthUser
  ): Promise<APIResponse<void>> {
    await this.projectService.deleteProject(id, user.id);

    return {
      success: true,
      metadata: {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### WebSocket Architecture

```typescript
// Socket.io event-driven architecture

class WebSocketGateway {
  private io: SocketIOServer;
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(
    private authService: AuthService,
    private eventBus: EventBus
  ) {}

  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN,
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const user = await this.authService.validateToken(token);

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.setupConnectionHandlers();
    this.subscribeToEvents();
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.user.id;

      // Track connection
      if (!this.connectedClients.has(userId)) {
        this.connectedClients.set(userId, new Set());
      }
      this.connectedClients.get(userId)!.add(socket.id);

      console.log(`User ${userId} connected via socket ${socket.id}`);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Handle disconnection
      socket.on('disconnect', () => {
        const clients = this.connectedClients.get(userId);
        if (clients) {
          clients.delete(socket.id);
          if (clients.size === 0) {
            this.connectedClients.delete(userId);
          }
        }
        console.log(`User ${userId} disconnected from socket ${socket.id}`);
      });

      // Project subscription
      socket.on('subscribe:project', (projectId: string) => {
        this.handleProjectSubscription(socket, projectId);
      });

      socket.on('unsubscribe:project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
      });

      // Session subscription
      socket.on('subscribe:session', (sessionId: string) => {
        this.handleSessionSubscription(socket, sessionId);
      });

      socket.on('unsubscribe:session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`);
      });

      // Command execution
      socket.on('execute:command', async (data: ExecuteCommandDto) => {
        await this.handleCommandExecution(socket, data);
      });
    });
  }

  private async handleProjectSubscription(socket: Socket, projectId: string): Promise<void> {
    const userId = socket.data.user.id;

    // Verify user has access to project
    const hasAccess = await this.projectService.userHasAccess(userId, projectId);

    if (!hasAccess) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'No access to project'
      });
      return;
    }

    // Join project room
    socket.join(`project:${projectId}`);

    // Send initial project state
    const projectState = await this.projectService.getProjectState(projectId);
    socket.emit('project:state', projectState);
  }

  private async handleSessionSubscription(socket: Socket, sessionId: string): Promise<void> {
    const userId = socket.data.user.id;

    // Verify user owns session
    const session = await this.sessionService.getSession(sessionId);

    if (!session || session.userId !== userId) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'No access to session'
      });
      return;
    }

    // Join session room
    socket.join(`session:${sessionId}`);

    // Send recent logs
    const logs = await this.logService.getRecentLogs(sessionId, 100);
    socket.emit('session:logs', logs);
  }

  private async handleCommandExecution(
    socket: Socket,
    data: ExecuteCommandDto
  ): Promise<void> {
    try {
      const userId = socket.data.user.id;

      // Create session
      const session = await this.sessionService.createSession({
        userId,
        projectId: data.projectId,
        command: data.command
      });

      // Execute command via wrapper
      await this.claudeWrapperService.executeCommand(
        session.id,
        data.command,
        data.options
      );

      // Notify client
      socket.emit('command:started', {
        sessionId: session.id,
        command: data.command
      });

    } catch (error) {
      socket.emit('command:error', {
        code: 'EXECUTION_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Subscribe to internal events and broadcast to clients
   */
  private subscribeToEvents(): void {
    // Process output events
    this.eventBus.on('process:output', (data: ProcessOutputEvent) => {
      this.io.to(`session:${data.sessionId}`).emit('session:output', {
        type: data.type,
        content: data.data,
        timestamp: new Date().toISOString()
      });
    });

    // Process completion events
    this.eventBus.on('process:completed', (data: ProcessCompletedEvent) => {
      this.io.to(`session:${data.sessionId}`).emit('session:completed', {
        sessionId: data.sessionId,
        exitCode: data.exitCode,
        success: data.success
      });
    });

    // Project updates
    this.eventBus.on('project:updated', (data: ProjectUpdatedEvent) => {
      this.io.to(`project:${data.projectId}`).emit('project:update', {
        projectId: data.projectId,
        changes: data.changes
      });
    });

    // Container events
    this.eventBus.on('container:started', (data: ContainerEvent) => {
      this.io.to(`project:${data.projectId}`).emit('infrastructure:container', {
        action: 'started',
        container: data.container
      });
    });

    this.eventBus.on('container:stopped', (data: ContainerEvent) => {
      this.io.to(`project:${data.projectId}`).emit('infrastructure:container', {
        action: 'stopped',
        container: data.container
      });
    });

    // Quota alerts
    this.eventBus.on('quota:warning', (data: QuotaWarningEvent) => {
      this.io.to(`user:${data.userId}`).emit('quota:alert', {
        provider: data.provider,
        remaining: data.remaining,
        total: data.total,
        threshold: data.threshold
      });
    });
  }

  /**
   * Emit event to specific user
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to project subscribers
   */
  emitToProject(projectId: string, event: string, data: any): void {
    this.io.to(`project:${projectId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }
}
```

### Event Bus Architecture

```typescript
// Internal event bus for service communication

class EventBus {
  private emitter: EventEmitter;
  private subscribers: Map<string, EventSubscription[]> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Subscribe to event
   */
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    const subscription: EventSubscription = {
      event,
      handler,
      unsubscribe: () => this.off(event, handler)
    };

    this.emitter.on(event, handler);

    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(subscription);

    return subscription;
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, handler: EventHandler): void {
    this.emitter.off(event, handler);

    const subs = this.subscribers.get(event);
    if (subs) {
      const index = subs.findIndex(s => s.handler === handler);
      if (index !== -1) {
        subs.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit<T = any>(event: string, data: T): void {
    this.emitter.emit(event, data);

    // Log event for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EventBus] ${event}:`, data);
    }
  }

  /**
   * Emit event asynchronously
   */
  async emitAsync<T = any>(event: string, data: T): Promise<void> {
    return new Promise((resolve) => {
      process.nextTick(() => {
        this.emit(event, data);
        resolve();
      });
    });
  }

  /**
   * Get all subscribers for event
   */
  getSubscribers(event: string): EventSubscription[] {
    return this.subscribers.get(event) || [];
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.emitter.removeAllListeners();
    this.subscribers.clear();
  }
}

// Event types
interface EventHandler<T = any> {
  (data: T): void | Promise<void>;
}

interface EventSubscription {
  event: string;
  handler: EventHandler;
  unsubscribe: () => void;
}

// Standard event interfaces
interface ProcessOutputEvent {
  sessionId: string;
  type: 'stdout' | 'stderr';
  data: string;
}

interface ProcessCompletedEvent {
  sessionId: string;
  exitCode: number;
  success: boolean;
}

interface ProjectUpdatedEvent {
  projectId: string;
  userId: string;
  changes: Partial<Project>;
}

interface ContainerEvent {
  projectId: string;
  container: Container;
}

interface QuotaWarningEvent {
  userId: string;
  provider: string;
  remaining: number;
  total: number;
  threshold: number;
}
```

---

## Security Architecture

### Authentication Flow

```
┌─────────┐                                  ┌─────────┐
│ Client  │                                  │ Server  │
└────┬────┘                                  └────┬────┘
     │                                            │
     │  POST /api/auth/login                     │
     │  { username, password }                   │
     ├──────────────────────────────────────────>│
     │                                            │
     │                                            │  Validate credentials
     │                                            │  Generate JWT + Refresh Token
     │                                            │  Store refresh token in Redis
     │                                            │
     │  200 OK                                    │
     │  {                                         │
     │    accessToken: "jwt...",                  │
     │    refreshToken: "refresh...",             │
     │    expiresIn: 900                          │
     │  }                                         │
     │<──────────────────────────────────────────┤
     │                                            │
     │  Store tokens in memory/storage            │
     │                                            │
     │                                            │
     │  GET /api/projects                         │
     │  Authorization: Bearer jwt...              │
     ├──────────────────────────────────────────>│
     │                                            │
     │                                            │  Verify JWT signature
     │                                            │  Check expiration
     │                                            │  Extract user claims
     │                                            │
     │  200 OK                                    │
     │  { projects: [...] }                       │
     │<──────────────────────────────────────────┤
     │                                            │
     │                                            │
     │  ... Token expires ...                     │
     │                                            │
     │  GET /api/projects                         │
     │  Authorization: Bearer expired_jwt...      │
     ├──────────────────────────────────────────>│
     │                                            │
     │                                            │  JWT expired
     │                                            │
     │  401 Unauthorized                          │
     │  { error: "Token expired" }                │
     │<──────────────────────────────────────────┤
     │                                            │
     │  POST /api/auth/refresh                    │
     │  { refreshToken: "refresh..." }            │
     ├──────────────────────────────────────────>│
     │                                            │
     │                                            │  Validate refresh token
     │                                            │  Check Redis store
     │                                            │  Generate new tokens
     │                                            │
     │  200 OK                                    │
     │  {                                         │
     │    accessToken: "new_jwt...",              │
     │    refreshToken: "new_refresh...",         │
     │    expiresIn: 900                          │
     │  }                                         │
     │<──────────────────────────────────────────┤
     │                                            │
```

### Authentication Implementation

```typescript
// JWT-based authentication service

interface JWTPayload {
  sub: string; // user ID
  username: string;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  iat: number;
  exp: number;
}

class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private userRepository: UserRepository,
    private encryptionService: EncryptionService,
    private redis: Redis,
    private jwtSecret: string
  ) {}

  /**
   * Authenticate user and generate tokens
   */
  async login(credentials: LoginDto): Promise<AuthResponse> {
    // Validate credentials
    const user = await this.userRepository.findByUsername(credentials.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await this.encryptionService.compare(
      credentials.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // Log successful login
    await this.auditService.log({
      userId: user.id,
      action: 'login',
      ipAddress: credentials.ipAddress,
      userAgent: credentials.userAgent
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      sub: user.id,
      username: user.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.ACCESS_TOKEN_EXPIRY
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * Generate refresh token and store in Redis
   */
  private async generateRefreshToken(user: User): Promise<string> {
    const tokenId = generateUUID();

    const payload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.REFRESH_TOKEN_EXPIRY
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256'
    });

    // Store token ID in Redis with user mapping
    await this.redis.setex(
      `refresh_token:${tokenId}`,
      this.REFRESH_TOKEN_EXPIRY,
      user.id
    );

    return token;
  }

  /**
   * Validate and decode access token
   */
  async validateAccessToken(token: string): Promise<User> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      // Get user from database
      const user = await this.userRepository.findById(payload.sub);

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid token');
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret) as RefreshTokenPayload;

      // Check if token exists in Redis
      const userId = await this.redis.get(`refresh_token:${payload.tokenId}`);

      if (!userId || userId !== payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findById(payload.sub);

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user);

      // Invalidate old refresh token
      await this.redis.del(`refresh_token:${payload.tokenId}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret) as RefreshTokenPayload;
      await this.redis.del(`refresh_token:${payload.tokenId}`);
    } catch (error) {
      // Silent fail - token might be already expired
    }
  }
}
```

### Authorization & Access Control

```typescript
// Role-Based Access Control (RBAC)

enum Role {
  ADMIN = 'admin',
  USER = 'user'
}

enum Permission {
  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',

  // Session permissions
  SESSION_CREATE = 'session:create',
  SESSION_READ = 'session:read',
  SESSION_TERMINATE = 'session:terminate',

  // Admin permissions
  USER_MANAGE = 'user:manage',
  SYSTEM_CONFIGURE = 'system:configure'
}

const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    ...Object.values(Permission)
  ],
  [Role.USER]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.SESSION_CREATE,
    Permission.SESSION_READ,
    Permission.SESSION_TERMINATE
  ]
};

class AuthorizationService {
  /**
   * Check if user has permission
   */
  hasPermission(user: User, permission: Permission): boolean {
    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes(permission);
  }

  /**
   * Check if user owns resource
   */
  async userOwnsResource(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    switch (resourceType) {
      case 'project':
        const project = await this.projectRepository.findById(resourceId);
        return project?.userId === userId;

      case 'session':
        const session = await this.sessionRepository.findById(resourceId);
        return session?.userId === userId;

      default:
        return false;
    }
  }

  /**
   * Verify user can perform action on resource
   */
  async authorize(
    user: User,
    permission: Permission,
    resourceType?: string,
    resourceId?: string
  ): Promise<boolean> {
    // Check permission
    if (!this.hasPermission(user, permission)) {
      return false;
    }

    // Check resource ownership if applicable
    if (resourceType && resourceId) {
      return this.userOwnsResource(user.id, resourceType, resourceId);
    }

    return true;
  }
}

// Middleware for authorization
function RequirePermission(permission: Permission) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      const user = req.user;

      if (!user) {
        throw new UnauthorizedException('Not authenticated');
      }

      const authService = container.get<AuthorizationService>(AuthorizationService);
      const authorized = await authService.authorize(user, permission);

      if (!authorized) {
        throw new ForbiddenException('Insufficient permissions');
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Usage example
class ProjectController {
  @RequirePermission(Permission.PROJECT_DELETE)
  async deleteProject(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const authService = container.get<AuthorizationService>(AuthorizationService);
    const owns = await authService.userOwnsResource(userId, 'project', id);

    if (!owns) {
      throw new ForbiddenException('Not project owner');
    }

    await this.projectService.deleteProject(id);
    res.status(204).send();
  }
}
```

### API Key Encryption

```typescript
// Secure storage of API keys

class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private masterKey: Buffer;

  constructor(masterKeyHex: string) {
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): string {
    // Generate random IV
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.masterKey, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV + Auth Tag + Encrypted Data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(ciphertext: string): string {
    // Decode from base64
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract components
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);

    // Create decipher
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Hash password
   */
  async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password with hash
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

// API Key management
class APIKeyService {
  constructor(
    private encryptionService: EncryptionService,
    private apiKeyRepository: APIKeyRepository
  ) {}

  /**
   * Store API key securely
   */
  async storeAPIKey(
    userId: string,
    provider: string,
    apiKey: string
  ): Promise<void> {
    // Encrypt API key
    const encrypted = this.encryptionService.encrypt(apiKey);

    // Store in database
    await this.apiKeyRepository.upsert({
      userId,
      provider,
      keyEncrypted: encrypted,
      isActive: true,
      lastUsedAt: null
    });
  }

  /**
   * Retrieve and decrypt API key
   */
  async getAPIKey(userId: string, provider: string): Promise<string | null> {
    const record = await this.apiKeyRepository.findByUserAndProvider(userId, provider);

    if (!record || !record.isActive) {
      return null;
    }

    // Decrypt API key
    return this.encryptionService.decrypt(record.keyEncrypted);
  }

  /**
   * Update last used timestamp
   */
  async markUsed(userId: string, provider: string): Promise<void> {
    await this.apiKeyRepository.updateLastUsed(userId, provider, new Date());
  }
}
```

### Input Validation & Sanitization

```typescript
// Schema validation using Zod

import { z } from 'zod';

// Project schemas
const CreateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .regex(/^[a-zA-Z0-9-_ ]+$/, 'Invalid characters in name'),

  description: z.string()
    .max(1000, 'Description too long')
    .optional(),

  type: z.enum(['claude-code', 'claude-flow']),

  gitRepository: z.string()
    .url('Invalid repository URL')
    .optional(),

  metadata: z.record(z.any())
    .optional()
});

const UpdateProjectSchema = CreateProjectSchema.partial();

// Command execution schema
const ExecuteCommandSchema = z.object({
  projectId: z.string().uuid(),

  command: z.object({
    cli: z.enum(['claude-code', 'claude-flow']),
    args: z.array(z.string())
      .max(50, 'Too many arguments')
  }),

  options: z.object({
    workingDirectory: z.string()
      .refine(val => {
        // Prevent path traversal
        return !val.includes('..') && !val.startsWith('/');
      }, 'Invalid working directory'),

    timeout: z.number()
      .int()
      .min(1000)
      .max(3600000) // Max 1 hour
      .optional()
  }).optional()
});

// Validation middleware
function ValidateBody(schema: z.ZodSchema) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      const res = args[1];

      try {
        // Validate request body
        req.body = schema.parse(req.body);

        // Call original method
        return originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors
            }
          });
        }
        throw error;
      }
    };

    return descriptor;
  };
}

// Sanitization utilities
class Sanitizer {
  /**
   * Sanitize HTML content
   */
  static sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href']
    });
  }

  /**
   * Sanitize file path
   */
  static sanitizePath(path: string): string {
    // Remove path traversal attempts
    let sanitized = path.replace(/\.\./g, '');

    // Remove leading slashes
    sanitized = sanitized.replace(/^\/+/, '');

    // Normalize path separators
    sanitized = sanitized.replace(/\\+/g, '/');

    return sanitized;
  }

  /**
   * Sanitize command arguments
   */
  static sanitizeCommandArgs(args: string[]): string[] {
    return args.map(arg => {
      // Remove shell metacharacters
      return arg.replace(/[;&|`$()]/g, '');
    });
  }
}
```

---

## Infrastructure Architecture

### Container Orchestration

```yaml
# Docker Compose for development

version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend/src:/app/src
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:5000/api
      - REACT_APP_WS_URL=ws://localhost:5000
    depends_on:
      - backend

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "5000:5000"
    volumes:
      - ./backend/src:/app/src
      - ./projects:/app/projects
      - /var/run/docker.sock:/var/run/docker.sock
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://claude:dev_password@postgres:5432/claude_dev
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev_jwt_secret_change_in_production
      - ENCRYPTION_KEY=dev_encryption_key_32_bytes_long
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SPEECHMATICS_API_KEY=${SPEECHMATICS_API_KEY}
    depends_on:
      - postgres
      - redis
      - rabbitmq

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=claude_dev
      - POSTGRES_USER=claude
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U claude"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # RabbitMQ Message Queue
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=claude
      - RABBITMQ_DEFAULT_PASS=dev_password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=claude
      - MINIO_ROOT_PASSWORD=dev_password
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:

networks:
  default:
    name: claude_dashboard_network
```

### Kubernetes Deployment

```yaml
# Kubernetes production deployment

# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: claude-dashboard

---

# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: claude-dashboard-config
  namespace: claude-dashboard
data:
  NODE_ENV: "production"
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "claude_prod"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  RABBITMQ_HOST: "rabbitmq-service"
  RABBITMQ_PORT: "5672"

---

# Secrets
apiVersion: v1
kind: Secret
metadata:
  name: claude-dashboard-secrets
  namespace: claude-dashboard
type: Opaque
data:
  DATABASE_PASSWORD: <base64-encoded>
  JWT_SECRET: <base64-encoded>
  ENCRYPTION_KEY: <base64-encoded>
  ANTHROPIC_API_KEY: <base64-encoded>
  OPENAI_API_KEY: <base64-encoded>
  SPEECHMATICS_API_KEY: <base64-encoded>

---

# Backend Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: claude-dashboard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: claude-dashboard-backend:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: claude-dashboard-config
              key: NODE_ENV
        - name: DATABASE_URL
          value: postgresql://$(DATABASE_USER):$(DATABASE_PASSWORD)@$(DATABASE_HOST):$(DATABASE_PORT)/$(DATABASE_NAME)
        envFrom:
        - configMapRef:
            name: claude-dashboard-config
        - secretRef:
            name: claude-dashboard-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: projects
          mountPath: /app/projects
      volumes:
      - name: projects
        persistentVolumeClaim:
          claimName: projects-pvc

---

# Backend Service
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: claude-dashboard
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5000
  type: ClusterIP

---

# Frontend Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: claude-dashboard
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: claude-dashboard-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"

---

# Frontend Service
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: claude-dashboard
spec:
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP

---

# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: claude-dashboard-ingress
  namespace: claude-dashboard
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - dashboard.example.com
    secretName: claude-dashboard-tls
  rules:
  - host: dashboard.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80

---

# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: claude-dashboard
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Scalability Design

### Horizontal Scaling Strategy

```typescript
// Load balancer configuration for stateless services

interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
  healthCheck: {
    endpoint: string;
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  stickySession: boolean;
}

const backendLoadBalancer: LoadBalancerConfig = {
  algorithm: 'least-connections',
  healthCheck: {
    endpoint: '/health',
    interval: 10000, // 10 seconds
    timeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2
  },
  stickySession: false // Stateless service
};

const websocketLoadBalancer: LoadBalancerConfig = {
  algorithm: 'ip-hash', // Maintain connection to same server
  healthCheck: {
    endpoint: '/health',
    interval: 10000,
    timeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2
  },
  stickySession: true // WebSocket connections need affinity
};
```

### Database Scaling

```typescript
// Read replica configuration

interface DatabaseConfig {
  primary: DatabaseConnection;
  replicas: DatabaseConnection[];
  replicationLag: number; // Maximum acceptable lag in seconds
}

class DatabasePool {
  private primaryPool: Pool;
  private replicaPools: Pool[];

  constructor(config: DatabaseConfig) {
    // Primary connection pool
    this.primaryPool = new Pool({
      host: config.primary.host,
      port: config.primary.port,
      database: config.primary.database,
      user: config.primary.user,
      password: config.primary.password,
      max: 20, // Maximum connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    // Replica connection pools
    this.replicaPools = config.replicas.map(replica =>
      new Pool({
        host: replica.host,
        port: replica.port,
        database: replica.database,
        user: replica.user,
        password: replica.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      })
    );
  }

  /**
   * Get connection for write operations
   */
  async getPrimaryConnection(): Promise<PoolClient> {
    return this.primaryPool.connect();
  }

  /**
   * Get connection for read operations (load balanced across replicas)
   */
  async getReplicaConnection(): Promise<PoolClient> {
    if (this.replicaPools.length === 0) {
      // Fallback to primary if no replicas
      return this.getPrimaryConnection();
    }

    // Simple round-robin selection
    const index = Math.floor(Math.random() * this.replicaPools.length);
    return this.replicaPools[index].connect();
  }

  /**
   * Execute read query on replica
   */
  async queryRead<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const client = await this.getReplicaConnection();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  /**
   * Execute write query on primary
   */
  async queryWrite<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const client = await this.getPrimaryConnection();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }
}
```

### Caching for Performance

```typescript
// Multi-layer caching strategy

class CachingService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private readonly MEMORY_CACHE_SIZE = 1000;
  private readonly MEMORY_CACHE_TTL = 60000; // 1 minute

  constructor(
    private redis: Redis,
    private database: DatabasePool
  ) {
    // Periodic cleanup of memory cache
    setInterval(() => this.cleanupMemoryCache(), 60000);
  }

  /**
   * Get with multi-layer caching
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number = 300): Promise<T> {
    // L1: Memory cache
    const memCached = this.getFromMemoryCache<T>(key);
    if (memCached !== null) {
      return memCached;
    }

    // L2: Redis cache
    const redisCached = await this.getFromRedisCache<T>(key);
    if (redisCached !== null) {
      // Store in memory cache
      this.setInMemoryCache(key, redisCached);
      return redisCached;
    }

    // L3: Database/source
    const value = await fetcher();

    // Store in all cache layers
    await Promise.all([
      this.setInRedisCache(key, value, ttl),
      this.setInMemoryCache(key, value)
    ]);

    return value;
  }

  /**
   * Invalidate across all cache layers
   */
  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.match(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private getFromMemoryCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  private setInMemoryCache<T>(key: string, value: T): void {
    // Evict oldest entry if cache is full
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + this.MEMORY_CACHE_TTL
    });
  }

  private async getFromRedisCache<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async setInRedisCache<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
  }
}

interface CacheEntry {
  value: any;
  expiresAt: number;
}
```

---

## Technology Stack Justification

### Frontend Stack

| Technology | Justification | Alternatives Considered |
|------------|---------------|------------------------|
| **React 18** | - Large ecosystem<br>- Concurrent rendering<br>- Excellent TypeScript support<br>- Team familiarity | Vue 3, Svelte |
| **TypeScript** | - Type safety<br>- Better IDE support<br>- Refactoring confidence<br>- Self-documenting code | JavaScript |
| **Zustand** | - Lightweight (1KB)<br>- Simple API<br>- No boilerplate<br>- Good DevTools | Redux Toolkit, Jotai |
| **React Query** | - Server state management<br>- Automatic caching<br>- Background refetching<br>- Optimistic updates | SWR, Apollo Client |
| **Tailwind CSS** | - Utility-first approach<br>- Fast development<br>- Consistent design<br>- Tree-shaking | Styled Components, CSS Modules |
| **Socket.io Client** | - Fallback transports<br>- Automatic reconnection<br>- Room support<br>- Reliable | Native WebSocket, WS |

### Backend Stack

| Technology | Justification | Alternatives Considered |
|------------|---------------|------------------------|
| **Node.js 18** | - JavaScript everywhere<br>- Non-blocking I/O<br>- Large package ecosystem<br>- CLI tool integration | Python, Go |
| **Express** | - Minimal and flexible<br>- Large middleware ecosystem<br>- Well-documented<br>- Team familiarity | Fastify, Koa |
| **TypeScript** | - Type safety<br>- Better IDE support<br>- Easier refactoring<br>- Compile-time errors | JavaScript |
| **TypeORM** | - TypeScript-first<br>- Active Record pattern<br>- Migration support<br>- Multi-database | Prisma, Sequelize |
| **Socket.io** | - Bidirectional communication<br>- Room/namespace support<br>- Automatic reconnection<br>- Load balancing | WS, uWebSockets.js |
| **Bull** | - Reliable job queue<br>- Redis-backed<br>- Retry logic<br>- Job prioritization | BullMQ, Agenda |

### Data Layer

| Technology | Justification | Alternatives Considered |
|------------|---------------|------------------------|
| **PostgreSQL 15** | - ACID compliance<br>- JSON support<br>- Advanced indexing<br>- Partitioning | MySQL, MongoDB |
| **Redis 7** | - In-memory speed<br>- Data structures<br>- Pub/sub support<br>- Persistence options | Memcached, KeyDB |
| **RabbitMQ** | - Reliable messaging<br>- Multiple protocols<br>- Dead letter queues<br>- Message durability | Kafka, NATS |
| **MinIO** | - S3-compatible API<br>- Self-hosted option<br>- High performance<br>- Kubernetes native | AWS S3, Google Cloud Storage |

### DevOps Stack

| Technology | Justification | Alternatives Considered |
|------------|---------------|------------------------|
| **Docker** | - Containerization standard<br>- Development parity<br>- Easy deployment<br>- Version control | Podman, LXC |
| **Kubernetes** | - Container orchestration<br>- Auto-scaling<br>- Self-healing<br>- Industry standard | Docker Swarm, Nomad |
| **Nginx** | - Reverse proxy<br>- Load balancing<br>- SSL termination<br>- High performance | Traefik, HAProxy |
| **GitHub Actions** | - Integrated with Git<br>- Easy configuration<br>- Free for open source<br>- Large marketplace | GitLab CI, CircleCI |

---

## Architecture Decision Records

### ADR-001: Microservices vs Monolith

**Status**: Accepted
**Date**: 2025-10-05

**Context**:
We need to decide between a microservices architecture and a monolithic architecture for the Claude Dashboard.

**Decision**:
We will use a **modular monolith** architecture with the option to extract services later.

**Rationale**:
- Simpler deployment and development for initial release
- Easier debugging and tracing
- Lower operational complexity
- Can be decomposed into microservices if needed
- Maintains service boundaries through modules

**Consequences**:
- Faster initial development
- Easier local development
- Less network overhead
- May need to refactor if scaling requirements change

---

### ADR-002: SQL vs NoSQL Database

**Status**: Accepted
**Date**: 2025-10-05

**Context**:
We need to choose primary database technology for storing projects, sessions, and user data.

**Decision**:
We will use **PostgreSQL** as the primary database.

**Rationale**:
- Strong ACID guarantees required for critical data
- Complex queries for analytics
- JSON support for flexible metadata
- Excellent performance for our use case
- Mature ecosystem and tooling
- Advanced features (partitioning, full-text search)

**Consequences**:
- Need to design schema carefully
- May need caching layer for performance
- Requires connection pooling
- Easier to maintain data consistency

---

### ADR-003: REST vs GraphQL

**Status**: Accepted
**Date**: 2025-10-05

**Context**:
We need to choose API architecture for client-server communication.

**Decision**:
We will use **REST API** with OpenAPI specification.

**Rationale**:
- Simpler to implement and understand
- Better caching support
- Wide client compatibility
- Easier to version
- Team familiarity
- Adequate for our use case

**Consequences**:
- May result in over-fetching/under-fetching
- More endpoints to maintain
- Need careful API design
- Can add GraphQL layer later if needed

---

### ADR-004: WebSocket vs Server-Sent Events

**Status**: Accepted
**Date**: 2025-10-05

**Context**:
We need bidirectional real-time communication for terminal output and logs.

**Decision**:
We will use **WebSocket (Socket.io)** for real-time communication.

**Rationale**:
- Bidirectional communication needed
- Lower latency than SSE
- Better browser support
- Room/namespace support
- Automatic reconnection
- Fallback to polling

**Consequences**:
- More complex than SSE
- Need to handle connection management
- Requires sticky sessions or Redis adapter
- Higher resource usage

---

### ADR-005: Session Storage Strategy

**Status**: Accepted
**Date**: 2025-10-05

**Context**:
We need to store user sessions for authentication.

**Decision**:
We will use **JWT access tokens** (15 min) with **Redis-backed refresh tokens** (7 days).

**Rationale**:
- JWT is stateless and scalable
- No database lookup for validation
- Redis provides fast session lookup
- Can invalidate refresh tokens
- Industry standard approach

**Consequences**:
- Cannot invalidate JWT before expiry
- Need to manage token refresh flow
- Redis becomes critical dependency
- Requires token rotation logic

---

## Conclusion

This comprehensive architecture provides a solid foundation for the Claude Dashboard:

### Key Architectural Strengths

1. **Modularity**: Clear separation of concerns with well-defined service boundaries
2. **Scalability**: Horizontal scaling capability with stateless services
3. **Security**: Multi-layer security with authentication, authorization, and encryption
4. **Performance**: Multi-level caching and optimized data access patterns
5. **Maintainability**: Clean code structure with TypeScript and comprehensive documentation
6. **Extensibility**: Plugin-based architecture allowing future enhancements

### Implementation Priorities

**Phase 1** (Weeks 1-4): Core infrastructure
- Authentication system
- Database schema
- Basic project management
- File operations

**Phase 2** (Weeks 5-8): CLI integration
- Claude wrapper service
- Process management
- WebSocket communication
- Log streaming

**Phase 3** (Weeks 9-12): Intelligence features
- Voice processing
- Prompt enhancement
- Scheduler system
- Analytics

**Phase 4** (Weeks 13-16): Production readiness
- Performance optimization
- Security hardening
- Testing coverage
- Documentation

### Success Metrics

- **Performance**: API response < 200ms (p95), WebSocket latency < 50ms
- **Reliability**: 99.9% uptime, < 0.1% error rate
- **Security**: Zero critical vulnerabilities, encryption at rest and in transit
- **Quality**: > 80% test coverage, comprehensive API documentation

This architecture ensures Claude Dashboard will be **scalable**, **secure**, **maintainable**, and **extensible** for future growth.

---

**Document Control**

- Version: 1.0
- Last Updated: 2025-10-05
- Next Review: 2025-11-05
- Owner: Architecture Team
- Status: Approved for Implementation
