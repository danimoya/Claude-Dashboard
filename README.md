# Claude Dashboard

> **Web-based GUI wrapper for Claude Code and Claude Flow CLI tools**

A comprehensive development platform providing an intuitive interface for AI-assisted development with advanced project management, voice input, and automation capabilities.

## 🚀 Features

- **Project Management** - Create and manage Claude Code and Claude Flow projects
- **Voice Input** - Speak your prompts instead of typing
- **Prompt Enhancement** - AI-powered prompt expansion and optimization
- **Real-time Terminal** - Live output streaming from Claude CLI
- **File Browser** - Integrated file explorer with Monaco editor
- **Task Scheduler** - Automated task execution with quota management
- **Infrastructure Monitoring** - Docker container management and metrics

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** >= 24.0.0
- **docker-compose** >= 2.20.0
- **PostgreSQL** 15+ (via Docker)
- **Redis** 7+ (via Docker)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/Claude-DashBoard.git
cd Claude-DashBoard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### 4. Start development services

```bash
# Start PostgreSQL and Redis
npm run docker:up

# Run database migrations
npm run db:migrate

# Seed development data (optional)
npm run db:seed
```

### 5. Start development servers

```bash
# Start all services (frontend + backend)
npm run dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Adminer** (DB GUI): http://localhost:8080

## 📁 Project Structure

```
claude-dashboard/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Node.js + Express + TypeScript
├── shared/            # Shared TypeScript types
├── infrastructure/    # Docker and deployment configs
├── docs/              # Documentation
├── tests/             # E2E Playwright tests
└── scripts/           # Utility scripts
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Frontend tests with coverage
npm run test --workspace=frontend -- --coverage

# Backend tests
npm run test --workspace=backend

# E2E tests
cd tests && npx playwright test
```

## 🏗️ Build

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=frontend
npm run build --workspace=backend
```

## 🐳 Docker Deployment

```bash
# Production build and deployment
docker-compose -f infrastructure/docker-compose.prod.yml up -d
```

## 📚 Documentation

- [Architecture](docs/architecture.md)
- [Development Plan](docs/development-plan.md)
- [API Documentation](docs/api/)
- [Testing Strategy](docs/testing-strategy.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Claude](https://www.anthropic.com/claude) by Anthropic
- Powered by Claude Code and Claude Flow CLI tools

---

**Status**: ✅ All Sprints Complete (Production Ready)

## 📊 Implementation Status

| Sprint | Features | Status |
|--------|----------|--------|
| Sprint 0 | Project Initialization | ✅ Complete |
| Sprint 1 | Auth & Core Backend | ✅ Complete |
| Sprint 2 | CLI Integration | ✅ Complete |
| Sprint 3 | WebSocket & Real-time | ✅ Complete |
| Sprint 4 | Voice & AI | ✅ Complete |
| Sprint 5 | Scheduler & Automation | ✅ Complete |
| Sprint 6 | Infrastructure & Monitoring | ✅ Complete |
| Sprint 7 | Comprehensive Testing | ✅ Complete |
| Sprint 8 | Production Polish | ✅ Complete |

**Total**: 70+ files, ~8,000 LOC, 6 database entities, 25+ API endpoints, Full WebSocket support

For detailed documentation, see [DEPLOYMENT.md](DEPLOYMENT.md)
