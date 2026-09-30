import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentCollectionStatus } from './enums';
import { PaymentCollectionRequest } from './payment-collection-request.entity';

@Entity('payment_collection_status_history')
export class PaymentCollectionStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  paymentCollectionRequestId: string;

  @Column({ type: 'enum', enum: PaymentCollectionStatus, nullable: true })
  previousStatus?: PaymentCollectionStatus | null;

  @Column({ type: 'enum', enum: PaymentCollectionStatus })
  newStatus: PaymentCollectionStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => PaymentCollectionRequest, (request) => request.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentCollectionRequestId' })
  paymentCollectionRequest: PaymentCollectionRequest;
}
