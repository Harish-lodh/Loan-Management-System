import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationType } from './enums';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ length: 120 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 20, default: 'NORMAL' })
  priority: 'LOW' | 'NORMAL' | 'HIGH';

  @Column({ type: 'varchar', length: 240, nullable: true })
  actionUrl?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Index()
  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
