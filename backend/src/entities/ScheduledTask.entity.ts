/**
 * Scheduled Task Entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Project } from './Project.entity.js';

@Entity('scheduled_tasks')
@Index(['projectId', 'enabled'])
export class ScheduledTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: 'cli_command' | 'backup' | 'cleanup' | 'sync';

  @Column({ type: 'varchar', length: 100 })
  schedule: string; // Cron expression

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'last_run', type: 'timestamp', nullable: true })
  lastRun: Date | null;

  @Column({ name: 'next_run', type: 'timestamp', nullable: true })
  nextRun: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
