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
import { MasterStatus } from './enums';
import { ProductVersion } from './product-version.entity';
import { Product } from './product.entity';
import { ProductWorkflowStep } from './product-workflow-step.entity';

@Entity('product_workflow_definitions')
@Index(['productId', 'productVersionId', 'workflowCode'], { unique: true })
export class ProductWorkflowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @Index()
  @Column()
  productVersionId: string;

  @Column({ length: 80 })
  workflowCode: string;

  @Column({ length: 140 })
  name: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Index()
  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => ProductVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productVersionId' })
  productVersion: ProductVersion;

  @OneToMany(() => ProductWorkflowStep, (step) => step.workflowDefinition)
  steps: ProductWorkflowStep[];
}
