import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ConsentType } from './enums';
import { LoanApplication } from './loan-application.entity';
import { User } from './user.entity';

@Entity('customer_consents')
@Index(['customerId', 'loanApplicationId', 'consentType', 'consentVersion'], { unique: true })
export class CustomerConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  customerId: string;

  @Index()
  @Column()
  loanApplicationId: string;

  @Column({ type: 'enum', enum: ConsentType })
  consentType: ConsentType;

  @Column({ length: 40 })
  consentVersion: string;

  @Column()
  accepted: boolean;

  @Column({ type: 'datetime', nullable: true })
  acceptedAt?: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source?: string | null;

  @Column({ length: 64 })
  consentTextHash: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanApplicationId' })
  loanApplication: LoanApplication;
}
