import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MasterStatus } from './enums';
import { Partner } from './partner.entity';
import { Product } from './product.entity';
import { ServiceProvider } from './service-provider.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 40 })
  organizationCode: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 180 })
  legalName: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  cin?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  rbiRegistrationNumber?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pan?: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  gstin?: string | null;

  @Column({ type: 'text', nullable: true })
  registeredAddress?: string | null;

  @Column({ type: 'json', nullable: true })
  supportDetails?: Record<string, unknown> | null;

  @Column({ length: 3, default: 'INR' })
  defaultCurrency: string;

  @Column({ length: 80, default: 'Asia/Kolkata' })
  timeZone: string;

  @Index()
  @Column({ type: 'enum', enum: MasterStatus, default: MasterStatus.ACTIVE })
  status: MasterStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'json', nullable: true })
  authorizedSignatory?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  bankConfiguration?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Partner, (partner) => partner.organization)
  partners: Partner[];

  @OneToMany(() => Product, (product) => product.organization)
  products: Product[];

  @OneToMany(() => ServiceProvider, (provider) => provider.organization)
  serviceProviders: ServiceProvider[];
}
