/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order, OrderSchema } from './schema/order.schema';
import { OrderLog, OrderLogSchema } from './schema/order-log.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderLog.name, schema: OrderLogSchema },
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
