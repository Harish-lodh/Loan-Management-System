import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { Notification, NotificationType } from '../database/entities';
import { NotificationsQueryDto } from './dto/notifications-query.dto';

type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  create(input: CreateNotificationInput): Promise<Notification>;
  create(userId: string, title: string, message: string, type: NotificationType): Promise<Notification>;
  create(
    inputOrUserId: CreateNotificationInput | string,
    title?: string,
    message?: string,
    type?: NotificationType,
  ): Promise<Notification> {
    const input =
      typeof inputOrUserId === 'string'
        ? {
            userId: inputOrUserId,
            title: title ?? '',
            message: message ?? '',
            type: type as NotificationType,
          }
        : inputOrUserId;

    return this.notificationsRepository.save(
      this.notificationsRepository.create({
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority ?? 'NORMAL',
        actionUrl: input.actionUrl ?? null,
        metadata: input.metadata ?? null,
      }),
    );
  }

  async listForUser(userId: string, query: NotificationsQueryDto = new NotificationsQueryDto()) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (query.type) {
      builder.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.unreadOnly) {
      builder.andWhere('notification.isRead = false');
    }

    if (query.search) {
      builder.andWhere('(notification.title LIKE :search OR notification.message LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [items, total] = await builder
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const unreadCount = await this.notificationsRepository.count({ where: { userId, isRead: false } });

    return { items, unreadCount, meta: paginationMeta(total, page, limit) };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notificationsRepository.findOne({ where: { id: notificationId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('You cannot update this notification');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationsRepository.save(notification);
  }

  async markAllRead(userId: string) {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return this.listForUser(userId);
  }
}
