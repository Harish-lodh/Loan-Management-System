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
import { LoanApplicationStatus } from './enums';
import { Product } from './product.entity';

@Entity('product_workflow_steps')
@Index(['productId', 'stepKey'], { unique: true })
export class ProductWorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @Column({ length: 80 })
  stepKey: string;

  @Column({ length: 120 })
  label: string;

  @Column({ type: 'enum', enum: LoanApplicationStatus })
  status: LoanApplicationStatus;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'json', nullable: true })
  requiredWhen?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  actorRole?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Product, (product) => product.workflowSteps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
