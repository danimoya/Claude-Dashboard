# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
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

# Build frontend (Vite)
RUN npm run build --workspace=frontend

# Build backend (TypeScript)
RUN npm run build --workspace=backend

# Stage 2: Production
FROM node:18-alpine AS production

RUN apk add --no-cache nginx

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --ignore-scripts --workspace=backend --workspace=shared

# Copy built artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
