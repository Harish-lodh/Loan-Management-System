import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission.entity';

@Entity('role_permissions')
@Index(['roleName', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 80 })
  roleName: string;

  @Index()
  @Column()
  permissionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;
}
