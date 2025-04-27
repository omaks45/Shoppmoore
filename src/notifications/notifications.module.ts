/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationGateway } from './notification.gateway';

@Module({
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService],
})
export class NotificationsModule {}
