import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DocumentType } from './enums';
import { DocumentTemplateVersion } from './document-template-version.entity';
import { LoanApplication } from './loan-application.entity';
import { Loan } from './loan.entity';

@Entity('generated_documents')
export class GeneratedDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: string;

  @Index()
  @Column()
  loanApplicationId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  loanId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  templateVersionId?: string | null;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column({ length: 180 })
  fileName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  storageUrl?: string | null;

  @Column({ type: 'mediumtext', nullable: true })
  contentHtml?: string | null;

  @Column({ length: 64 })
  checksum: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  generatedBy?: string | null;

  @Column({ default: false })
  immutable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanApplicationId' })
  loanApplication: LoanApplication;

  @ManyToOne(() => Loan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'loanId' })
  loan?: Loan | null;

  @ManyToOne(() => DocumentTemplateVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'templateVersionId' })
  templateVersion?: DocumentTemplateVersion | null;
}
