/**
 * Session Entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { ProjectType, SessionStatus } from '@shared/types';
import { Project } from './Project.entity.js';
import { Task } from './Task.entity.js';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: ProjectType;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: SessionStatus;

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @ManyToOne(() => Project, (project) => project.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @OneToMany(() => Task, (task) => task.session)
  tasks!: Task[];
}
