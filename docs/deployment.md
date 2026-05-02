# Claude Dashboard Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+
- Docker and Docker Compose (optional)

## Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

### Backend (.env)

```bash
# Server
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=claude_dashboard
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=claude_dashboard_prod

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_very_long_random_secret_minimum_32_characters
JWT_REFRESH_SECRET=another_very_long_random_secret_minimum_32_characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# API Keys (optional)
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OPENAI_API_KEY=sk-your-openai-key
SPEECHMATICS_API_KEY=your-speechmatics-key

# CORS
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Frontend (.env)

```bash
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=https://api.your-domain.com
```

## Docker Deployment (Recommended)

### 1. Build Images

```bash
# Build backend
cd backend
docker build -t claude-dashboard-backend:latest .

# Build frontend
cd ../frontend
docker build -t claude-dashboard-frontend:latest .
```

### 2. Run with Docker Compose

```bash
cd infrastructure
docker-compose -f docker-compose.prod.yml up -d
```

## Manual Deployment

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb claude_dashboard_prod

# Run migrations
cd backend
npm run migrate
```

### 2. Build Backend

```bash
cd backend
npm install --production
npm run build
```

### 3. Build Frontend

```bash
cd frontend
npm install
npm run build
```

### 4. Start Services

```bash
# Start backend server
cd backend
npm start

# Start CLI worker (separate process)
npm run start:worker

# Serve frontend (using nginx or similar)
# Configure nginx to serve frontend/dist
```

## Nginx Configuration

```nginx
# Frontend
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}

# Backend API
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## SSL/TLS (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start backend/dist/server.js --name claude-dashboard-api

# Start worker
pm2 start backend/dist/workers/cli.worker.js --name claude-dashboard-worker

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

## Monitoring

### Prometheus Metrics

Access metrics at: `http://localhost:3000/metrics`

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs

```bash
# PM2 logs
pm2 logs

# Docker logs
docker logs claude-dashboard-backend
docker logs claude-dashboard-worker
```

## Backup

### Database Backup

```bash
# Create backup
pg_dump claude_dashboard_prod > backup_$(date +%Y%m%d).sql

# Restore backup
psql claude_dashboard_prod < backup_20250101.sql
```

### Redis Backup

```bash
# Redis automatically saves RDB snapshots
# Configure in redis.conf:
save 900 1
save 300 10
save 60 10000
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall (UFW/iptables)
- [ ] Set up rate limiting
- [ ] Enable CORS with specific origins
- [ ] Regular security updates
- [ ] Database connection over SSL
- [ ] Secure Redis with password
- [ ] Disable debug mode in production
- [ ] Set up monitoring and alerts

## Performance Optimization

### Backend
- Enable compression middleware
- Use connection pooling (configured)
- Redis caching (configured)
- Database indexes (configured)
- Queue workers for heavy tasks (configured)

### Frontend
- Code splitting (Vite default)
- Asset optimization (build process)
- CDN for static assets
- Lazy loading components
- Service worker for offline support

## Troubleshooting

### Connection Issues
```bash
# Check services
systemctl status postgresql
systemctl status redis

# Test database connection
psql -h localhost -U claude_dashboard claude_dashboard_prod

# Test Redis connection
redis-cli ping
```

### Worker Not Processing Jobs
```bash
# Check Bull queue
# Access Bull Board at http://localhost:3000/admin/queues

# Restart worker
pm2 restart claude-dashboard-worker
```

### High Memory Usage
```bash
# Check Node.js memory
pm2 monit

# Increase Node.js memory limit
node --max-old-space-size=4096 dist/server.js
```

## Scaling

### Horizontal Scaling
- Run multiple backend instances behind load balancer
- Use Redis for session sharing
- Shared PostgreSQL instance
- Socket.IO with Redis adapter (configured)

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Add read replicas for PostgreSQL
- Use Redis Cluster for high availability

## Maintenance

### Regular Tasks
- Database vacuum and analyze
- Redis key expiration cleanup
- Log rotation
- Dependency updates
- Security patches

### Monitoring Alerts
- High CPU/memory usage
- Database connection failures
- Redis connection issues
- Queue job failures
- Error rate threshold exceeded
