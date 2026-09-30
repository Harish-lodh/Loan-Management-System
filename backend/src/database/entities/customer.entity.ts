import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MONEY_COLUMN } from '../transformers/decimal.transformer';
import { CustomerStatus, EmploymentType } from './enums';
import { LoanApplication } from './loan-application.entity';
import { Loan } from './loan.entity';
import { Organization } from './organization.entity';
import { Repayment } from './repayment.entity';

// Borrower record (CIF). Created and maintained by NBFC staff; borrowers have no login.
@Entity('customers')
@Index(['organizationId', 'panHash'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string | null;

  @Index({ unique: true })
  @Column({ length: 40 })
  customerNumber: string;

  @Column({ length: 120 })
  fullName: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email?: string | null;

  @Index()
  @Column({ length: 24 })
  phone: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender?: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  panMasked?: string | null;

  @Column({ type: 'char', length: 64, nullable: true, select: false })
  panHash?: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  panEncrypted?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  state?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  occupation?: string | null;

  @Column({ type: 'enum', enum: EmploymentType, nullable: true })
  employmentType?: EmploymentType | null;

  @Column({ ...MONEY_COLUMN, nullable: true })
  monthlyIncome?: number | null;

  @Index()
  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  status: CustomerStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdById?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @OneToMany(() => LoanApplication, (application) => application.customer)
  loanApplications: LoanApplication[];

  @OneToMany(() => Loan, (loan) => loan.customer)
  loans: Loan[];

  @OneToMany(() => Repayment, (repayment) => repayment.customer)
  repayments: Repayment[];
}
