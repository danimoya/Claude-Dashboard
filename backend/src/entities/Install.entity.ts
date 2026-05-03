/**
 * Install Entity
 *
 * One row per dashboard installation. Holds the random `installation_id`
 * (generated once on first boot), the user-controlled telemetry / update-
 * check toggles, and the timestamp of the last ping. No PII, no IP.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('installs')
export class Install {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Random opaque identifier generated on first boot and stored here. Sent
   * to the telemetry endpoint when (and only when) the user has opted in.
   */
  @Column({ unique: true })
  installationId!: string;

  /** Telemetry ping enabled? Default OFF. */
  @Column({ default: false })
  telemetryEnabled!: boolean;

  /** Update-check button enabled? Default OFF. (Independent of telemetry.) */
  @Column({ default: false })
  updateChecksEnabled!: boolean;

  /** When the user last accepted/changed the telemetry preferences. */
  @Column({ type: 'timestamp', nullable: true })
  telemetryDecidedAt?: Date;

  /** Last successful telemetry ping (informational only — shown in /telemetry). */
  @Column({ type: 'timestamp', nullable: true })
  lastPingAt?: Date;

  /** Last update-check fetch (informational). */
  @Column({ type: 'timestamp', nullable: true })
  lastUpdateCheckAt?: Date;

  /** Latest version we saw on the public update feed (cached). */
  @Column({ nullable: true })
  latestVersionSeen?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
