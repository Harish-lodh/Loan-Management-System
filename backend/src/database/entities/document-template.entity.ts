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
import { DocumentTemplateStatus, DocumentType } from './enums';
import { Organization } from './organization.entity';
import { Partner } from './partner.entity';
import { Product } from './product.entity';
import { DocumentTemplateVersion } from './document-template-version.entity';

@Entity('document_templates')
@Index(['organizationId', 'documentType', 'productId', 'partnerId', 'language', 'version'], { unique: true })
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  productId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId?: string | null;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column({ length: 12, default: 'en-IN' })
  language: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'datetime', nullable: true })
  effectiveFrom?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  effectiveTo?: Date | null;

  @Index()
  @Column({ type: 'enum', enum: DocumentTemplateStatus, default: DocumentTemplateStatus.DRAFT })
  status: DocumentTemplateStatus;

  @Column({ length: 160 })
  title: string;

  @Column({ type: 'mediumtext' })
  templateHtml: string;

  @Column({ type: 'json', nullable: true })
  allowedPlaceholders?: string[] | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'partnerId' })
  partner?: Partner | null;

  @OneToMany(() => DocumentTemplateVersion, (version) => version.template)
  versions: DocumentTemplateVersion[];
}
