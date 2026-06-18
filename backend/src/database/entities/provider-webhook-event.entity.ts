import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProviderType } from './enums';

@Entity('provider_webhook_events')
@Index(['providerCode', 'providerEventId'], { unique: true })
export class ProviderWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Column({ length: 60 })
  providerCode: string;

  @Column({ type: 'enum', enum: ProviderType })
  providerType: ProviderType;

  @Column({ length: 160 })
  providerEventId: string;

  @Column({ length: 80 })
  eventType: string;

  @Column({ type: 'json', nullable: false })
  headersSnapshot: Record<string, unknown>;

  @Column({ type: 'json', nullable: false })
  payload: Record<string, unknown>;

  @Column({ default: false })
  signatureVerified: boolean;

  @Column({ default: false })
  processed: boolean;

  @Column({ type: 'datetime', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  processingError?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  payloadHash?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
