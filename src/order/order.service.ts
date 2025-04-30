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
import { PopulatedOrder } from './order.types'; // Adjust the import path as necessary

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
  
    // Fetch the full order with populated fields
    const populatedOrder = await this.orderModel
    .findById(newOrder._id)
    .populate('buyer', 'firstName email fullName')
    .populate('orderItems.productId', 'name') as unknown as PopulatedOrder;
  
    // Convert orderItems to the shape NotificationService expects
    const orderToSend = {
      _id: populatedOrder._id,
      items: populatedOrder.orderItems.map((item: any) => ({
        productName: item.productId.name,
        quantity: item.quantity,
      })),
      totalAmount: populatedOrder.totalPrice,
      estimatedDeliveryDate: populatedOrder.estimatedDeliveryDate || null,
    };
  
    const user = {
      email: populatedOrder.buyer.email,
      firstName: populatedOrder.buyer.firstName || populatedOrder.buyer.lastName,
    };
  
    await this.notificationService.sendOrderConfirmationEmail(user, orderToSend);
  
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
  
    // Populate the order details just like in createOrder()
    const populatedOrder = await this.orderModel
      .findById(orderId)
      .populate('buyer', 'firstName email fullName')
      .populate('orderItems.productId', 'name') as unknown as PopulatedOrder;
  
    const orderToSend = {
      _id: populatedOrder._id,
      items: populatedOrder.orderItems.map((item: any) => ({
        productName: item.productId.name,
        quantity: item.quantity,
      })),
      totalAmount: populatedOrder.totalPrice,
      estimatedDeliveryDate: populatedOrder.estimatedDeliveryDate || null,
    };
  
    const user = {
      email: populatedOrder.buyer.email,
      firstName: populatedOrder.buyer.firstName || populatedOrder.buyer.lastName,
    };
  
    // Handle status-specific email notifications
    if (dto.status === 'delivered') {
      await this.notificationService.sendOrderDeliveredEmail(user, orderToSend);
    }
  
    if (dto.status === 'cancelled') {
      await this.notificationService.sendOrderCancelledEmail(user, orderToSend);
    }
  
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

    // order.service.ts

async markOrderAsPaid(reference: string): Promise<void> {
  const order = await this.orderModel.findOne({ reference });

  if (!order) throw new NotFoundException('Order not found for reference');

  order.isPaid = true;
  order.status = 'paid'; // Optional: update order status too
  await order.save();

  await this.logModel.create({
    orderId: order._id,
    action: 'payment_successful',
    performedBy: order.buyer,
  });

  // Optionally: send payment confirmation email
  const populatedOrder = await this.orderModel
    .findById(order._id)
    .populate('buyer', 'firstName email')
    .populate('orderItems.productId', 'name') as unknown as PopulatedOrder;

  const orderToSend = {
    _id: populatedOrder._id,
    items: populatedOrder.orderItems.map((item: any) => ({
      productName: item.productId.name,
      quantity: item.quantity,
    })),
    totalAmount: populatedOrder.totalPrice,
    estimatedDeliveryDate: populatedOrder.estimatedDeliveryDate || null,
  };

  const user = {
    email: populatedOrder.buyer.email,
    firstName: populatedOrder.buyer.firstName,
  };

  await this.notificationService.sendPaymentConfirmationEmail(user, orderToSend);
}

}
