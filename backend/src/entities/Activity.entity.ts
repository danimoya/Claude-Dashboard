/**
 * Activity Entity
 * Stores user activity logs
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('activities')
@Index(['projectId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  user: any;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne('Project', { onDelete: 'CASCADE' })
  project: any;

  @Column({ type: 'varchar', length: 50 })
  type: 'file_edit' | 'session_start' | 'session_end' | 'command_run' | 'project_create' | 'project_update';

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
