import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LoanApplicationStatus } from './enums';
import { LoanApplication } from './loan-application.entity';

@Entity('application_status_transitions')
@Index(['loanApplicationId', 'createdAt'])
export class ApplicationStatusTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  loanApplicationId: string;

  @Column({ type: 'enum', enum: LoanApplicationStatus, nullable: true })
  previousStatus?: LoanApplicationStatus | null;

  @Index()
  @Column({ type: 'enum', enum: LoanApplicationStatus })
  newStatus: LoanApplicationStatus;

  @Column({ length: 80 })
  action: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  actorRole?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'text', nullable: true })
  comments?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanApplicationId' })
  loanApplication: LoanApplication;
}
