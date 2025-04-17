/* eslint-disable prettier/prettier */
// order/order.service.ts
import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schema/order.schema';
import { OrderLog, OrderLogDocument } from './schema/order-log.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderLog.name) private logModel: Model<OrderLogDocument>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const newOrder = await this.orderModel.create(dto);

    await this.logModel.create({
      orderId: newOrder._id,
      action: 'created',
      performedBy: dto.buyer,
    });

    await this.notificationService.sendOrderConfirmationEmail(dto.buyer, newOrder._id);

    return newOrder;
  }

  async getOrderById(orderId: string) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('buyer', 'fullName email phone address')
      .populate('orderItems.productId', 'name price images');

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrdersByBuyer(buyerId: string) {
    return this.orderModel
      .find({ buyer: buyerId })
      .populate('orderItems.productId', 'name price')
      .populate('buyer', 'fullName email phone address');
  }

  async getAllOrders(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const total = await this.orderModel.countDocuments();
    const orders = await this.orderModel
      .find()
      .skip(skip)
      .limit(limit)
      .populate('orderItems.productId', 'name price')
      .populate('buyer', 'fullName email');

    return { total, page, limit, orders };
  }

  async updateStatus(orderId: string, dto: UpdateStatusDto) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.status = dto.status;
    await order.save();

    await this.logModel.create({
      orderId,
      action: dto.status,
      performedBy: dto.performedBy,
    });

    if (dto.status === 'delivered')
      await this.notificationService.sendOrderDeliveredEmail(order.buyer, order._id);

    if (dto.status === 'cancelled')
      await this.notificationService.sendOrderCancelledEmail(order.buyer, order._id);

    return order;
  }

  async getLogs(orderId: string) {
    return this.logModel.find({ orderId }).sort({ createdAt: -1 });
  }

  async logAssignment(orderId: string, adminId: string) {
    return this.logModel.create({
      orderId,
      action: 'assigned',
      performedBy: adminId,
    });
  }
}
