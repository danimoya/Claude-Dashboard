/**
 * Task Entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { TaskStatus } from '@shared/types';
import { Session } from './Session.entity.js';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'text' })
  command!: string;

  @Column({ type: 'simple-array', nullable: true })
  args?: string[];

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: TaskStatus;

  @Column({ type: 'text', nullable: true })
  output?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @ManyToOne(() => Session, (session) => session.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: Session;
}
