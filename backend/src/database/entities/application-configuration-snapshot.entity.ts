import { Column, CreateDateColumn, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LoanApplication } from './loan-application.entity';

@Entity('application_configuration_snapshots')
export class ApplicationConfigurationSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  loanApplicationId: string;

  @Index()
  @Column()
  organizationId: string;

  @Index()
  @Column()
  productId: string;

  @Index()
  @Column()
  productVersionId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId?: string | null;

  @Column({ type: 'json', nullable: false })
  resolvedConfiguration: Record<string, unknown>;

  @Column({ type: 'json', nullable: false })
  productSnapshot: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  partnerSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  partnerProductSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: false })
  fieldsSnapshot: Record<string, unknown>[];

  @Column({ type: 'json', nullable: false })
  eligibilityRulesSnapshot: Record<string, unknown>[];

  @Column({ type: 'json', nullable: false })
  workflowSnapshot: Record<string, unknown>[];

  @Column({ type: 'json', nullable: false })
  applicantSnapshot: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  pricingSnapshot?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanApplicationId' })
  loanApplication: LoanApplication;
}
