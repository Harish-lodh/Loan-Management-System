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
import { MasterStatus } from './enums';
import { Product } from './product.entity';

@Entity('product_eligibility_rules')
@Index(['productId', 'ruleCode', 'version'], { unique: true })
export class ProductEligibilityRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @Column({ length: 80 })
  ruleCode: string;

  @Column({ length: 140 })
  name: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Index()
  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ type: 'json', nullable: false })
  ruleDefinition: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Product, (product) => product.eligibilityRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
