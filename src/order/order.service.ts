/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
  Logger,
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
import { ProductService } from '../products/products.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderLog.name) private logModel: Model<OrderLogDocument>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => CartService))
    public cartService: CartService,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
  ) {}

  /**
   * Create order from cart (optimized for payment flow)
   * This method is called when payment is successful
   */
  async createOrderFromCart(buyerId: string, paymentReference: string): Promise<Order> {
    const session = await this.orderModel.db.startSession();
    
    try {
      return await session.withTransaction(async () => {
        this.logger.log(`Creating order from cart for buyer: ${buyerId}, payment ref: ${paymentReference}`);

        // Get full cart data
        const cartData = await this.cartService.getFullCart(new Types.ObjectId(buyerId));
        
        if (!cartData || !cartData.items || cartData.items.length === 0) {
          throw new BadRequestException('Cart is empty or not found');
        }

        // Validate stock availability for all items before creating order
        const stockValidation = await this.validateCartStock(cartData.items);
        if (!stockValidation.isValid) {
          throw new BadRequestException(`Stock validation failed: ${stockValidation.errors.join(', ')}`);
        }

        // Create order items from cart
        const orderItems = cartData.items.map(item => ({
          productId: this.toObjectId(
            typeof item.productId === 'object' && item.productId !== null && '_id' in item.productId
              ? item.productId._id.toString()
              : item.productId.toString()
          ),
          quantity: item.quantity,
          priceSnapshot: item.priceSnapshot,
          total: item.total,
        }));

        // Calculate totals
        const subtotal = cartData.items.reduce((sum, item) => sum + item.total, 0);
        const shippingFee = cartData.totalWithShipping - subtotal;

        // Generate order reference if not provided
        const reference = paymentReference || `ORD-${randomUUID()}`;
        
        const orderData = {
          buyer: this.toObjectId(buyerId),
          orderItems,
          subtotal,
          shippingFee,
          totalPrice: cartData.totalWithShipping,
          reference,
          status: OrderStatus.PENDING,
          isPaid: !!paymentReference, // Set to true if payment reference is provided
          paymentReference: paymentReference || null,
          estimatedDeliveryDate: this.calculateDeliveryDate(),
        };

        // Create the order
        const newOrder = await this.orderModel.create([orderData], { session });
        const order = newOrder[0];

        this.logger.log(`Order created with ID: ${order._id}, Reference: ${reference}`);

        // Update product stock for each item
        await this.updateProductStocks(cartData.items, session);

        // Log order creation
        await this.logOrderAction(
          order._id, 
          OrderAction.CREATED, 
          buyerId, 
          { paymentReference, totalAmount: cartData.totalWithShipping },
          'system'
        );

        // If payment reference exists, log payment
        if (paymentReference) {
          await this.logOrderAction(
            order._id,
            OrderAction.PAID,
            buyerId,
            { paymentReference, amount: cartData.totalWithShipping },
            'system'
          );
        }
        // After order creation in createOrderFromCart
        if (paymentReference) {
        await this.sendOrderNotification(order._id, OrderStatus.PAID);
        } else {
        await this.sendOrderNotification(order._id, OrderStatus.PENDING);
        }
        this.logger.log(`Order notification sent for order ID: ${order._id}`);
             

        // Clear the cart after successful order creation
        await this.cartService.clearCart(new Types.ObjectId(buyerId));
        this.logger.log(`Cart cleared for buyer: ${buyerId}`);

        return order;
      });
    } catch (error) {
      this.logger.error(`Failed to create order from cart for buyer ${buyerId}:`, error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Mark order as paid and send confirmation email
   * Called from payment webhook
   */
  async markOrderAsPaid(reference: string): Promise<void> {
    try {
      this.logger.log(`Marking order as paid for reference: ${reference}`);

      const order = await this.orderModel.findOne<OrderDocument>({ 
        $or: [
          { reference }, 
          { paymentReference: reference }
        ]
      });

      if (!order) {
        // If order doesn't exist, try to create it from the payment reference
        // This handles cases where payment completes before order creation
        await this.handlePaymentBeforeOrder(reference);
        return;
      }

      // Update order status
      order.isPaid = true;
      order.status = OrderStatus.PAID;
      order.paymentReference = reference;
      order.paidAt = new Date();
      
      await order.save();

      // Log payment
      await this.logOrderAction(
        order._id, 
        OrderAction.PAID, 
        order.buyer.toString(),
        { paymentReference: reference },
        'system'
      );

      // Send email notification
      await this.sendOrderNotification(order._id, OrderStatus.PAID);
      
      this.logger.log(`Order ${order._id} marked as paid and email sent`);
    } catch (error) {
      this.logger.error(`Failed to mark order as paid for reference ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Handle case where payment completes before order creation
   */
  private async handlePaymentBeforeOrder(paymentReference: string): Promise<void> {
    try {
      // Extract user info from payment reference if possible
      // Assuming reference format: TXN-timestamp-userId
      const parts = paymentReference.split('-');
      if (parts.length >= 3) {
        const userId = parts[2];
        
        this.logger.log(`Creating order from payment reference: ${paymentReference} for user: ${userId}`);
        
        // Create order from cart
        const order = await this.createOrderFromCart(userId, paymentReference);
        
        // Send notification
        await this.sendOrderNotification((order as any)._id, OrderStatus.PAID);
      } else {
        this.logger.error(`Cannot extract user ID from payment reference: ${paymentReference}`);
        throw new NotFoundException(`Order not found for payment reference: ${paymentReference}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle payment before order for reference ${paymentReference}:`, error);
      throw error;
    }
  }

  /**
   * Validate stock availability for cart items
   */
  private async validateCartStock(cartItems: any[]): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    for (const item of cartItems) {
      const productId = item.productId._id || item.productId;
      const validation = await this.productService.validateBulkOrderQuantities(
        productId.toString(), 
        item.quantity
      );
      
      if (!validation.isValid) {
        errors.push(`${item.productId.name || productId}: ${validation.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update product stocks after order creation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async updateProductStocks(cartItems: any[], session: any): Promise<void> {
    const stockUpdates = cartItems.map(async (item) => {
      const productId = item.productId._id || item.productId;
      await this.productService.updateStockAfterOrder(
        productId.toString(), 
        item.quantity
      );
    });

    await Promise.all(stockUpdates);
    this.logger.log(`Updated stock for ${cartItems.length} products`);
  }

  /**
   * Calculate estimated delivery date
   */
  private calculateDeliveryDate(): Date {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7); // 7 days from now
    return deliveryDate;
  }

  /**
   * Send order notification based on status
   */
  async sendOrderNotification(orderId: string | Types.ObjectId, status: OrderStatus): Promise<void> {
    try {
      const { user, orderToSend } = await this.prepareNotificationData(orderId);
      
      switch (status) {
        case OrderStatus.PENDING:
          await this.notificationService.sendOrderConfirmationEmail(user, orderToSend);
          break;
        case OrderStatus.PAID:
          await this.notificationService.sendPaymentConfirmationEmail(user, orderToSend);
          break;
        case OrderStatus.DELIVERED:
          await this.notificationService.sendOrderDeliveredEmail(user, orderToSend);
          break;
        case OrderStatus.CANCELLED:
          await this.notificationService.sendOrderCancelledEmail(user, orderToSend);
          break;
        default:
          this.logger.warn(`No email notification defined for status: ${status}`);
      }
      
      this.logger.log(`Email notification sent for order ${orderId} with status ${status}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for order ${orderId}:`, error);
      // Don't throw error here to avoid breaking the main flow
    }
  }

  /**
   * Legacy create order method (keeping for backward compatibility)
   */
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
      .populate('buyer', 'fullName email phone address')
      .sort({ createdAt: -1 });
  }

  async getAllOrders(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const total = await this.orderModel.countDocuments();
    const orders = await this.orderModel
      .find()
      .skip(skip)
      .limit(limit)
      .populate('orderItems.productId', 'name price')
      .populate('buyer', 'fistName lastName email')
      .sort({ createdAt: -1 });

    return { total, page, limit, orders };
  }

  async updateStatus(orderId: string, dto: UpdateStatusDto): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const oldStatus = order.status;
    order.status = dto.status as OrderStatus;
    await order.save();

    await this.logOrderAction(
      order._id,
      OrderAction[dto.status as keyof typeof OrderAction],
      dto.performedBy,
      { oldStatus, newStatus: dto.status }
    );

    // Send notification for status change
    await this.sendOrderNotification(order._id, dto.status as OrderStatus);

    return order;
  }

  async getLogs(orderId: string) {
    return this.logModel
      .find({ orderId: this.toObjectId(orderId) })
      .sort({ createdAt: -1 });
  }

  async logAssignment(orderId: string, adminId: string) {
    return this.logOrderAction(orderId, OrderAction.ASSIGNED, adminId);
  }

  /**
   * Get order by payment reference
   */
  async getOrderByPaymentReference(reference: string): Promise<Order | null> {
    return this.orderModel.findOne({ 
      $or: [
        { reference }, 
        { paymentReference: reference }
      ]
    });
  }

  /**
   * Get recent orders for dashboard
   */
  async getRecentOrders(limit = 10): Promise<Order[]> {
    return this.orderModel
      .find()
      .populate('buyer', 'fullName lastName email')
      .populate('orderItems.productId', 'name price')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    paid: number;
    delivered: number;
    cancelled: number;
    totalRevenue: number;
  }> {
    const [stats] = await this.orderModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.PENDING] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.PAID] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.DELIVERED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$isPaid', true] }, '$totalPrice', 0] } }
        }
      }
    ]);

    return stats || {
      total: 0,
      pending: 0,
      paid: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0
    };
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
      .populate('orderItems.productId', 'name price');

    if (!order) throw new NotFoundException('Order not found');
    return order as unknown as PopulatedOrder;
  }

  private buildOrderSummary(order: PopulatedOrder) {
    return {
      _id: order._id,
      reference: order.reference,
      items: order.orderItems.map(item => ({
        productName: item.productId.name,
        quantity: item.quantity,
        price: item.priceSnapshot || item.productId.price,
        total: item.total,
      })),
      subtotal: order.subtotal || order.orderItems.reduce((sum, item) => sum + (item.total || 0), 0),
      shippingFee: order.shippingFee || 0,
      totalAmount: order.totalPrice,
      status: order.status,
      estimatedDeliveryDate: order.estimatedDeliveryDate || null,
      orderDate: order.createdAt,
    };
  }

  private async prepareNotificationData(orderId: string | Types.ObjectId) {
    const populatedOrder = await this.populateOrder(orderId);
    const orderToSend = this.buildOrderSummary(populatedOrder);
    const user = {
      email: populatedOrder.buyer.email,
      firstName: populatedOrder.buyer.firstName || populatedOrder.buyer.lastName?.split(' ')[0] || 'Customer',
    };
    return { populatedOrder, orderToSend, user };
  }
}