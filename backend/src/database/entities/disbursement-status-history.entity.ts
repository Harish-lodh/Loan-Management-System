import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DisbursementStatus } from './enums';
import { Disbursement } from './disbursement.entity';

@Entity('disbursement_status_history')
export class DisbursementStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  disbursementId: string;

  @Column({ type: 'enum', enum: DisbursementStatus, nullable: true })
  previousStatus?: DisbursementStatus | null;

  @Column({ type: 'enum', enum: DisbursementStatus })
  newStatus: DisbursementStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Disbursement, (disbursement) => disbursement.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disbursementId' })
  disbursement: Disbursement;
}
