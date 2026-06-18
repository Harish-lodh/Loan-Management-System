import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MasterStatus } from './enums';
import { Product } from './product.entity';

@Entity('product_versions')
@Index(['productId', 'version'], { unique: true })
export class ProductVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.DRAFT })
  status: MasterStatus;

  @Column({ type: 'datetime', nullable: true })
  effectiveFrom?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  effectiveTo?: Date | null;

  @Column({ type: 'json', nullable: false })
  configurationSnapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'datetime', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Product, (product) => product.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
