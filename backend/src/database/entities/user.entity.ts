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
import { LoanApplication } from './loan-application.entity';
import { Loan } from './loan.entity';
import { Notification } from './notification.entity';
import { Repayment } from './repayment.entity';

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

  @Column({ type: 'double', nullable: true })
  annualIncome?: number | null;

  @Column({ type: 'text', nullable: true, select: false })
  refreshTokenHash?: string | null;

  @Column({ type: 'datetime', nullable: true })
  refreshTokenExpiresAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string | null;

  @Index()
  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'json', nullable: true })
  permissions?: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LoanApplication, (application) => application.user)
  loanApplications: LoanApplication[];

  @OneToMany(() => Loan, (loan) => loan.user)
  loans: Loan[];

  @OneToMany(() => Repayment, (repayment) => repayment.user)
  repayments: Repayment[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.actor)
  auditLogs: AuditLog[];
}
