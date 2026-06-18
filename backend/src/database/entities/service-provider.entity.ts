import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MasterStatus, ProviderType } from './enums';
import { Organization } from './organization.entity';

@Entity('service_providers')
@Index(['organizationId', 'providerCode'], { unique: true })
export class ServiceProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Column({ length: 60 })
  providerCode: string;

  @Column({ length: 140 })
  providerName: string;

  @Index()
  @Column({ type: 'enum', enum: ProviderType })
  providerType: ProviderType;

  @Index()
  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ default: true })
  isSandbox: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  baseUrl?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true, select: false })
  credentialReference?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true, select: false })
  webhookSecretReference?: string | null;

  @Column({ type: 'json', nullable: true })
  supportedCapabilities?: string[] | null;

  @Column({ type: 'json', nullable: true })
  configuration?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.serviceProviders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;
}
