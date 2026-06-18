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
import { ApplicationFieldType } from './enums';
import { Product } from './product.entity';

@Entity('product_application_fields')
@Index(['productId', 'fieldKey'], { unique: true })
export class ProductApplicationField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @Column({ length: 80 })
  fieldKey: string;

  @Column({ length: 120 })
  label: string;

  @Column({ type: 'enum', enum: ApplicationFieldType })
  fieldType: ApplicationFieldType;

  @Column({ type: 'varchar', length: 180, nullable: true })
  placeholder?: string | null;

  @Column({ type: 'text', nullable: true })
  helpText?: string | null;

  @Column({ default: false })
  required: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'json', nullable: true })
  defaultValue?: unknown;

  @Column({ type: 'json', nullable: true })
  validationRules?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  options?: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  visibilityConditions?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  editableStatuses?: string[] | null;

  @Column({ default: false })
  sensitive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Product, (product) => product.applicationFields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
