/**
 * TypeORM Database Configuration
 */

import { DataSource } from 'typeorm';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

// Import entities
import { User } from '../entities/User.entity.js';
import { Project } from '../entities/Project.entity.js';
import { Session } from '../entities/Session.entity.js';
import { Task } from '../entities/Task.entity.js';
import { CLISession } from '../entities/CLISession.entity.js';
import { Activity } from '../entities/Activity.entity.js';
import { ScheduledTask } from '../entities/ScheduledTask.entity.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,

  // Synchronize schema (auto-create tables from entities)
  synchronize: true,

  // Logging
  logging: config.env === 'development' ? ['query', 'error'] : ['error'],
  logger: 'advanced-console',

  // Entities
  entities: [User, Project, Session, Task, CLISession, Activity, ScheduledTask],

  // Migrations
  migrations: ['src/migrations/**/*.ts'],
  migrationsTableName: 'migrations',

  // Connection pool
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});

/**
 * Initialize database connection with retry logic
 */
export async function connectDatabase(retries = 5, delay = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await AppDataSource.initialize();
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${i + 1} failed:`, error);

      if (i < retries - 1) {
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
