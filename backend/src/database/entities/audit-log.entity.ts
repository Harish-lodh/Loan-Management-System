import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'int' })
  @Generated('increment')
  sequence: number;

  @Column({ length: 80 })
  action: string;

  @Column({ length: 80 })
  entityType: string;

  @Column()
  entityId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'json', nullable: false })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  previousHash?: string | null;

  @Index({ unique: true })
  @Column({ length: 64 })
  currentHash: string;

  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorUserId' })
  actor?: User | null;
}
