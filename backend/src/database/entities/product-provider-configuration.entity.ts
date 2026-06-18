import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MasterStatus, ProviderType } from './enums';
import { ProductVersion } from './product-version.entity';
import { Product } from './product.entity';
import { ServiceProvider } from './service-provider.entity';

@Entity('product_provider_configurations')
@Index(['productId', 'productVersionId', 'providerType'], { unique: true })
export class ProductProviderConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  productId: string;

  @Index()
  @Column()
  productVersionId: string;

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

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => ProductVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productVersionId' })
  productVersion: ProductVersion;

  @ManyToOne(() => ServiceProvider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'providerId' })
  provider?: ServiceProvider | null;
}
