-- Database initialization script for Claude Dashboard

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial tables will be handled by TypeORM migrations
-- This script is for database-level configuration only

-- Set timezone
SET timezone = 'UTC';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE claude_dashboard_dev TO claude;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

COMMENT ON DATABASE claude_dashboard_dev IS 'Claude Dashboard Development Database';
