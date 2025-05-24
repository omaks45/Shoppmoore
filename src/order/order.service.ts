/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schema/order.schema';
import {
  OrderLog,
  OrderLogDocument,
  OrderAction,
} from './schema/order-log.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { NotificationService } from '../notifications/notifications.service';
import { PopulatedOrder } from './order.types';
import { randomUUID } from 'crypto';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderLog.name) private logModel: Model<OrderLogDocument>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => CartService))
    public cartService: CartService,

  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const reference = `ORD-${randomUUID()}`;
    const orderData = {
      ...dto,
      buyer: this.toObjectId(dto.buyer),
      orderItems: dto.orderItems.map(item => ({
        productId: this.toObjectId(item.productId),
        quantity: item.quantity,
      })),
      reference,
    };

    const newOrder = await this.orderModel.create(orderData);
    await this.logOrderAction(newOrder._id, OrderAction.CREATED, dto.buyer);

    const { user, orderToSend } = await this.prepareNotificationData(newOrder._id);
    await this.notificationService.sendOrderConfirmationEmail(user, orderToSend);

    await this.cartService.clearCart(this.toObjectId(dto.buyer));
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
      .find({ buyer: this.toObjectId(buyerId) })
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

  async updateStatus(orderId: string, dto: UpdateStatusDto): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.status = dto.status as OrderStatus;
    await order.save();

    await this.logOrderAction(
      order._id,
      OrderAction[dto.status as keyof typeof OrderAction],
      dto.performedBy,
    );

    const { user, orderToSend } = await this.prepareNotificationData(order._id);
    await this.notifyByStatus(dto.status as OrderStatus, user, orderToSend);

    return order;
  }

  async markOrderAsPaid(reference: string): Promise<void> {
    const order = await this.orderModel.findOne({ reference });
    if (!order) throw new NotFoundException('Order not found for reference');

    order.isPaid = true;
    order.status = OrderStatus.PAID;
    await order.save();

    await this.logOrderAction(order._id, OrderAction.PAID, order.buyer.toString());

    const { user, orderToSend } = await this.prepareNotificationData(order._id);
    await this.notifyByStatus(OrderStatus.PAID, user, orderToSend);
  }

  async getLogs(orderId: string) {
    return this.logModel
      .find({ orderId: this.toObjectId(orderId) })
      .sort({ createdAt: -1 });
  }

  async logAssignment(orderId: string, adminId: string) {
    return this.logOrderAction(orderId, OrderAction.ASSIGNED, adminId);
  }

  /** ------------------ Utility Methods ------------------ */

  private toObjectId(id: string): Types.ObjectId {
    return new Types.ObjectId(id);
  }

  private async logOrderAction(
    orderId: string | Types.ObjectId,
    action: OrderAction,
    performedBy?: string,
    metadata?: Record<string, any>,
    actorType: 'user' | 'system' = 'user',
  ): Promise<OrderLogDocument> {
    return this.logModel.create({
      orderId: this.toObjectId(orderId.toString()),
      action,
      performedBy: performedBy ? this.toObjectId(performedBy) : undefined,
      metadata,
      actorType,
    });
  }

  private async populateOrder(orderId: string | Types.ObjectId): Promise<PopulatedOrder> {
    const order = await this.orderModel
      .findById(orderId)
      .populate('buyer', 'firstName lastName email fullName')
      .populate('orderItems.productId', 'name');

    if (!order) throw new NotFoundException('Order not found');
    return order as unknown as PopulatedOrder;
  }

  private buildOrderSummary(order: PopulatedOrder) {
    return {
      _id: order._id,
      items: order.orderItems.map(item => ({
        productName: item.productId.name,
        quantity: item.quantity,
      })),
      totalAmount: order.totalPrice,
      estimatedDeliveryDate: order.estimatedDeliveryDate || null,
    };
  }

  private async prepareNotificationData(orderId: string | Types.ObjectId) {
    const populatedOrder = await this.populateOrder(orderId);
    const orderToSend = this.buildOrderSummary(populatedOrder);
    const user = {
      email: populatedOrder.buyer.email,
      firstName: populatedOrder.buyer.firstName || populatedOrder.buyer.lastName,
    };
    return { populatedOrder, orderToSend, user };
  }

  private async notifyByStatus(
    status: OrderStatus,
    user: { email: string; firstName: string },
    orderSummary: any,
  ): Promise<void> {
    switch (status) {
      case OrderStatus.DELIVERED:
        await this.notificationService.sendOrderDeliveredEmail(user, orderSummary);
        break;
      case OrderStatus.CANCELLED:
        await this.notificationService.sendOrderCancelledEmail(user, orderSummary);
        break;
      case OrderStatus.PAID:
        await this.notificationService.sendPaymentConfirmationEmail(user, orderSummary);
        break;
    }
  }
}
