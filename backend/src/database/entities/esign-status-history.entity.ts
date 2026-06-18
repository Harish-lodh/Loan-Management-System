import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ESignRequestStatus } from './enums';
import { ESignRequest } from './esign-request.entity';

@Entity('esign_status_history')
export class ESignStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  esignRequestId: string;

  @Column({ type: 'enum', enum: ESignRequestStatus, nullable: true })
  previousStatus?: ESignRequestStatus | null;

  @Column({ type: 'enum', enum: ESignRequestStatus })
  newStatus: ESignRequestStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ESignRequest, (esignRequest) => esignRequest.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'esignRequestId' })
  esignRequest: ESignRequest;
}
