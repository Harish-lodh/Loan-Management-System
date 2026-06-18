import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ENachMandateStatus } from './enums';
import { ENachMandate } from './enach-mandate.entity';

@Entity('enach_mandate_status_history')
export class ENachMandateStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  mandateId: string;

  @Column({ type: 'enum', enum: ENachMandateStatus, nullable: true })
  previousStatus?: ENachMandateStatus | null;

  @Column({ type: 'enum', enum: ENachMandateStatus })
  newStatus: ENachMandateStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ENachMandate, (mandate) => mandate.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mandateId' })
  mandate: ENachMandate;
}
