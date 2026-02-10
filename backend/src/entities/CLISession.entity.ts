/**
 * CLI Session Entity
 * Stores metadata about CLI sessions
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
import type { ProjectType } from '@shared/types';

@Entity('cli_sessions')
@Index(['projectId', 'status'])
@Index(['startedAt'])
export class CLISession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne('Project', { onDelete: 'CASCADE' })
  project: any;

  @Column({ type: 'varchar', length: 20 })
  type: ProjectType;

  @Column({ type: 'text' })
  command: string;

  @Column({ type: 'simple-array', nullable: true })
  args: string[];

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: 'running' | 'stopped' | 'error';

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'last_activity', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActivity: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
