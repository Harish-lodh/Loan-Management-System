import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DocumentTemplateStatus } from './enums';
import { DocumentTemplate } from './document-template.entity';

@Entity('document_template_versions')
@Index(['templateId', 'version'], { unique: true })
export class DocumentTemplateVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  templateId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'enum', enum: DocumentTemplateStatus, default: DocumentTemplateStatus.DRAFT })
  status: DocumentTemplateStatus;

  @Column({ type: 'mediumtext' })
  templateHtml: string;

  @Column({ type: 'json', nullable: true })
  placeholders?: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy?: string | null;

  @Column({ type: 'datetime', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => DocumentTemplate, (template) => template.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: DocumentTemplate;
}
