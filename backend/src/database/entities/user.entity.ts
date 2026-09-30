import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { Role } from './enums';
import { Notification } from './notification.entity';

// Staff accounts only (NBFC employees and the platform vendor). Borrowers are `Customer` records.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 160 })
  email: string;

  @Column({ length: 24 })
  phone: string;

  @Column({ length: 120 })
  password: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  occupation?: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  refreshTokenHash?: string | null;

  @Column({ type: 'datetime', nullable: true })
  refreshTokenExpiresAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  // Null only for SUPER_ADMIN, which is not tied to a single NBFC.
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string | null;

  @Index()
  @Column({ type: 'enum', enum: Role, default: Role.VIEWER })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  permissions?: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.actor)
  auditLogs: AuditLog[];
}
