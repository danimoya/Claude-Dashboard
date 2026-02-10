# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and root tsconfig
COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY shared/ ./shared/
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build shared types first
RUN npm run build --workspace=shared

# Build frontend (Vite only — skip tsc typecheck in Docker)
RUN cd frontend && npx vite build

# Build backend (TypeScript)
RUN npm run build --workspace=backend

# Stage 2: Production
FROM node:18-alpine AS production

RUN apk add --no-cache nginx python3 make g++

WORKDIR /app

# Copy package files and install production deps
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --ignore-scripts --workspace=backend --workspace=shared && \
    npm rebuild bcrypt --workspace=backend

# Copy built artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Create @shared module alias so backend can resolve @shared/* imports at runtime
RUN mkdir -p node_modules/@shared && \
    for f in shared/dist/*.js; do \
      name=$(basename "$f" .js); \
      mkdir -p "node_modules/@shared/$name"; \
      echo "{\"name\":\"@shared/$name\",\"type\":\"module\",\"main\":\"../../../shared/dist/$name.js\"}" > "node_modules/@shared/$name/package.json"; \
    done

# Create logs directory for Winston
RUN mkdir -p /app/logs

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
