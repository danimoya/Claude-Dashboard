/**
 * Project Entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { ProjectType, ProjectStatus } from '@shared/types';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: ProjectType;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  path!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: ProjectStatus;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne('User', 'projects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: any;

  @OneToMany('Session', 'project')
  sessions!: any[];
}
