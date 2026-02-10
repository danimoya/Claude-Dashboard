# Development Environment Setup Guide

## Quick Start

```bash
# Clone and setup
git clone <repository-url> Claude-DashBoard
cd Claude-DashBoard

# Run automated setup
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh

# Start development
npm run dev
```

---

## Prerequisites

### Required Software

| Software | Minimum Version | Installation |
|----------|----------------|--------------|
| Node.js | 18.0.0 | [nodejs.org](https://nodejs.org) |
| npm | 9.0.0 | Included with Node.js |
| Docker | 24.0.0 | [docker.com](https://docker.com) |
| Docker Compose | 2.20.0 | [docs.docker.com](https://docs.docker.com/compose/install/) |
| Git | 2.40.0 | [git-scm.com](https://git-scm.com) |
| PostgreSQL | 15.0 | Via Docker or [postgresql.org](https://www.postgresql.org) |
| Redis | 7.0 | Via Docker or [redis.io](https://redis.io) |

### Optional Tools

- **VS Code**: Recommended IDE with extensions
- **Postman**: API testing
- **pgAdmin**: PostgreSQL management
- **Redis Commander**: Redis management

---

## Environment Setup

### 1. Directory Structure Creation

Create the project structure:

```bash
mkdir -p Claude-DashBoard/{frontend,backend,shared,infrastructure,scripts,docs}
cd Claude-DashBoard

# Initialize git
git init
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "dist/" >> .gitignore
echo "logs/" >> .gitignore
```

### 2. Environment Variables

Copy and configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# .env

# ===== Server Configuration =====
NODE_ENV=development
PORT=5000

# ===== Database Configuration =====
DATABASE_URL=postgresql://claude:dev_password@localhost:5432/claude_dev
DB_HOST=localhost
DB_PORT=5432
DB_USER=claude
DB_PASSWORD=dev_password
DB_NAME=claude_dev

# ===== Redis Configuration =====
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ===== Authentication =====
# Generate with: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-change-this
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ===== API Keys (Optional) =====
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SPEECHMATICS_API_KEY=

# ===== Claude CLI Configuration =====
CLAUDE_CLI_PATH=claude
CLAUDE_TIMEOUT=300000

# ===== File System =====
PROJECTS_ROOT=./projects
MAX_FILE_SIZE=104857600

# ===== WebSocket =====
WS_PORT=5001

# ===== Rate Limiting =====
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# ===== Frontend =====
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5001
```

### 3. Docker Services Setup

Create development Docker Compose file:

```bash
mkdir -p infrastructure/docker
```

Create `infrastructure/docker/docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: claude-dashboard-db
    environment:
      POSTGRES_DB: claude_dev
      POSTGRES_USER: claude
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U claude"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: claude-dashboard-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: claude-dashboard-redis-ui
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: claude-dashboard-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@claude.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "8080:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

Start Docker services:

```bash
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

---

## Project Initialization

### Backend Setup

```bash
# Create backend directory
mkdir -p backend/src/{config,entities,modules,services,middleware,utils,routes,migrations}

# Initialize package.json
cd backend
npm init -y

# Install dependencies
npm install express typeorm pg redis bull socket.io jsonwebtoken bcrypt zod winston dotenv cors helmet express-rate-limit tsyringe reflect-metadata

# Install dev dependencies
npm install -D @types/express @types/node @types/bcrypt @types/jsonwebtoken @types/cors typescript tsx vitest @vitest/coverage-v8 eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Initialize TypeScript
npx tsc --init
```

Configure `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Update `backend/package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typeorm": "typeorm-ts-node-commonjs",
    "migration:generate": "npm run typeorm -- migration:generate -d src/config/database.config.ts",
    "migration:run": "npm run typeorm -- migration:run -d src/config/database.config.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/config/database.config.ts"
  }
}
```

### Frontend Setup

```bash
# Create frontend with Vite
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend

# Install dependencies
npm install react-router-dom @tanstack/react-query zustand axios socket.io-client lucide-react @monaco-editor/react xterm xterm-addon-fit recharts zod

# Install dev dependencies
npm install -D @types/react @types/react-dom vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event tailwindcss autoprefixer postcss

# Initialize Tailwind CSS
npx tailwindcss init -p
```

Configure `frontend/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Update `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:5001',
        ws: true,
      },
    },
  },
})
```

### Shared Package Setup

```bash
# Create shared package
cd ..
mkdir -p shared/{types,constants,utils}
cd shared

# Initialize package.json
npm init -y

# Install dependencies
npm install zod

# Install dev dependencies
npm install -D typescript @types/node
```

---

## Development Workflow

### Starting Development Servers

**Option 1: Run all services individually**

```bash
# Terminal 1: Docker services
docker-compose -f infrastructure/docker/docker-compose.dev.yml up

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

**Option 2: Using Turborepo (Recommended)**

```bash
# From root directory
npm run dev
```

### Database Management

**Run migrations:**

```bash
cd backend
npm run migration:run
```

**Generate new migration:**

```bash
cd backend
npm run migration:generate -- src/migrations/MigrationName
```

**Revert last migration:**

```bash
cd backend
npm run migration:revert
```

**Seed database:**

```bash
cd backend
npm run seed
```

---

## Testing

### Backend Testing

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/modules/auth/auth.service.test.ts

# Watch mode
npm test -- --watch
```

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- src/components/Login.test.tsx

# Watch mode
npm test -- --watch
```

### E2E Testing

```bash
# Install Playwright
npm install -D @playwright/test

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

---

## Code Quality Tools

### ESLint Configuration

Create `backend/.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["@typescript-eslint"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "warn"
  }
}
```

Create `frontend/.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### Git Hooks (Husky)

```bash
# Install Husky
npm install -D husky lint-staged

# Initialize Husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

---

## VS Code Setup

### Recommended Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens",
    "PKief.material-icon-theme",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense",
    "ms-azuretools.vscode-docker"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port
lsof -i :5000  # Backend
lsof -i :3000  # Frontend

# Kill process
kill -9 <PID>
```

#### 2. Database Connection Failed

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs claude-dashboard-db

# Restart container
docker restart claude-dashboard-db
```

#### 3. Redis Connection Failed

```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
redis-cli ping

# Restart container
docker restart claude-dashboard-redis
```

#### 4. TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Rebuild
npm run build
```

#### 5. Module Not Found

```bash
# Clear node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

---

## Monitoring and Debugging

### Backend Debugging

Add to `backend/package.json`:

```json
{
  "scripts": {
    "debug": "tsx --inspect-brk src/server.ts"
  }
}
```

VS Code launch configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "debug"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

### Frontend Debugging

Use React DevTools and Redux DevTools browser extensions.

### Database Debugging

Access pgAdmin at `http://localhost:8080`:
- Email: `admin@claude.local`
- Password: `admin`

### Redis Debugging

Access Redis Commander at `http://localhost:8081`

---

## Performance Optimization

### Backend Optimization

1. **Enable Caching**
   - Use Redis for frequently accessed data
   - Implement cache invalidation strategies

2. **Database Indexing**
   - Add indexes to frequently queried columns
   - Use EXPLAIN ANALYZE to optimize queries

3. **Connection Pooling**
   - Configure optimal pool size in TypeORM

### Frontend Optimization

1. **Code Splitting**
   - Implement lazy loading for routes
   - Use React.lazy() for heavy components

2. **Bundle Optimization**
   - Analyze bundle with `npm run build -- --analyze`
   - Remove unused dependencies

3. **Caching**
   - Configure React Query caching strategies
   - Use service workers for offline support

---

## Security Checklist

- [ ] Environment variables not committed to Git
- [ ] JWT secret is strong and unique
- [ ] Database credentials are secure
- [ ] API rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation implemented
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection enabled
- [ ] HTTPS in production
- [ ] Security headers configured (Helmet)

---

## Next Steps

1. **Complete Project Scaffolding**
   - Run setup script
   - Verify all services are running

2. **Implement Core Features**
   - Start with authentication module
   - Build project management
   - Integrate CLI wrapper

3. **Add Testing**
   - Write unit tests
   - Add integration tests
   - Setup E2E tests

4. **Documentation**
   - API documentation
   - Component storybook
   - User guides

---

## Resources

- [TypeORM Documentation](https://typeorm.io)
- [React Query Documentation](https://tanstack.com/query)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Vite Documentation](https://vitejs.dev)
- [Express.js Documentation](https://expressjs.com)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-05
**Author:** CODER Agent (Hive Mind Swarm)
