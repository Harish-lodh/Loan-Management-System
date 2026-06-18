import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MasterStatus, ProviderType } from './enums';
import { Partner } from './partner.entity';
import { ServiceProvider } from './service-provider.entity';

@Entity('partner_provider_configurations')
@Index(['partnerId', 'providerType'], { unique: true })
export class PartnerProviderConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  partnerId: string;

  @Column({ type: 'enum', enum: ProviderType })
  providerType: ProviderType;

  @Column({ type: 'varchar', length: 36, nullable: true })
  providerId?: string | null;

  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ type: 'json', nullable: true })
  configuration?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Partner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'providerId' })
  provider?: ServiceProvider | null;
}
