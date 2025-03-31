/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { NotificationService } from '../notifications/notifications.service';

@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
