import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('idempotency_records')
@Index(['scope', 'idempotencyKey'], { unique: true })
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  scope: string;

  @Column({ length: 160 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  entityId?: string | null;

  @Column({ type: 'json', nullable: true })
  requestHash?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  responseSnapshot?: Record<string, unknown> | null;

  @Column({ length: 40, default: 'PROCESSING' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
