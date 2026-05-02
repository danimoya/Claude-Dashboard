/**
 * User Entity
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import bcrypt from 'bcrypt';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: 'jsonb', nullable: true })
  apiKeys?: {
    anthropic?: string;
    openai?: string;
    speechmatics?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    voiceProvider?: string;
    editorFontSize?: number;
  };

  @Column({ default: true })
  isActive!: boolean;

  // ── Two-factor authentication (TOTP) ─────────────────────────
  // 2FA gates entry to /settings, which holds API keys and other secrets.
  // Reset/disable from CLI: scripts/2fa-admin.sh (docker exec helper).
  @Column({ default: false })
  twofaEnabled!: boolean;

  @Column({ select: false, nullable: true })
  twofaSecret?: string;

  @Column({ type: 'jsonb', nullable: true, select: false })
  twofaBackupCodes?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany('Project', 'user')
  projects!: any[];

  // Virtual field for password (not persisted)
  password?: string;

  /**
   * Hash password before insert
   */
  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    if (this.password) {
      this.passwordHash = await bcrypt.hash(this.password, 10);
    }
  }

  /**
   * Hash password before update
   */
  @BeforeUpdate()
  async hashPasswordBeforeUpdate() {
    if (this.password) {
      this.passwordHash = await bcrypt.hash(this.password, 10);
    }
  }

  /**
   * Compare password with hash
   */
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.passwordHash);
  }

  /**
   * Convert to JSON (exclude sensitive fields)
   */
  toJSON() {
    const { passwordHash, password, twofaSecret, twofaBackupCodes, ...user } = this;
    return user;
  }
}
