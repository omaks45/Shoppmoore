/* eslint-disable prettier/prettier */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
import { firstValueFrom } from 'rxjs';
import { PaystackInitResponse } from './interfaces/paystack.interface';
import { Inject, forwardRef } from '@nestjs/common';
import { OrderService } from '../order/order.service';
import * as crypto from 'crypto';
import { Types } from 'mongoose';

@Injectable()
export class PaymentService {
  private readonly paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  /**
   * Initialize payment transaction with Paystack
   */
  async initializeTransaction(dto: InitializeTransactionDto & { email: string, userId: string }): Promise<PaystackInitResponse> {
    this.logger.log(`Initializing transaction for user: ${dto.userId}`);

    try {
      // Validate input
      this.validateTransactionInput(dto);

      // Get and validate cart
      const cartData = await this.getValidatedCart(dto.userId);
      
      // Generate payment reference
      const reference = this.generatePaymentReference(dto.userId);
      
      // Prepare payment payload
      const paystackPayload = this.buildPaystackPayload(dto, cartData, reference);
      
      // Log payment details
      this.logPaymentDetails(cartData, paystackPayload);

      // Initialize transaction with Paystack
      const response = await this.callPaystackAPI('/transaction/initialize', paystackPayload);

      this.logger.log(`Transaction initialized successfully. Reference: ${reference}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to initialize transaction for user ${dto.userId}:`, {
        error: error.message,
        stack: error.stack
      });
      
      // Re-throw known errors
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to initialize payment. Please try again.');
    }
  }

  /**
   * Handle Paystack webhooks
   */
  async handleWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event === 'charge.success') {
      await this.handleSuccessfulPayment(data);
    } else {
      this.logger.debug(`Webhook ignored for event: ${event}`);
    }
  }

  /**
   * Verify transaction status with Paystack
   */
  async verifyTransactionByReference(reference: string): Promise<any> {
    try {
      const verification = await this.verifyTransaction(reference);
      
      if (!verification.status) {
        this.logger.warn(`Transaction verification failed for reference: ${reference}`);
      } else {
        this.logger.log(`Transaction verified successfully - Ref: ${reference}, Amount: ₦${verification.data.amount / 100}`);
      }
      
      return verification;
    } catch (error) {
      this.logger.error(`Error verifying transaction ${reference}:`, error.message);
      throw new BadRequestException('Transaction verification failed');
    }
  }

  /**
   * Get cart totals for display purposes
   */
  async getCartTotal(userId: string): Promise<{ subtotal: number; shipping: number; total: number }> {
    try {
      const cartData = await this.findUserCart(userId);
      
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        return { subtotal: 0, shipping: 750, total: 750 };
      }

      const subtotal = cartData.items.reduce((sum, item) => sum + item.total, 0);
      const total = cartData.totalWithShipping;
      const shipping = total - subtotal;

      return { subtotal, shipping, total };
    } catch (error) {
      this.logger.error(`Error getting cart total for user ${userId}:`, error.message);
      return { subtotal: 0, shipping: 750, total: 750 };
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(req: any): boolean {
    try {
      const hash = crypto
        .createHmac('sha512', this.paystackSecret)
        .update(req.rawBody)
        .digest('hex');

      const signature = req.headers['x-paystack-signature'];
      const isValid = hash === signature;

      if (!isValid) {
        this.logger.warn('Invalid Paystack webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error.message);
      return false;
    }
  }

  /** ================== PRIVATE METHODS ================== */

  /**
   * Validate transaction input parameters
   */
  private validateTransactionInput(dto: any): void {
    if (!dto.userId) {
      throw new BadRequestException('User ID is required for payment processing');
    }

    if (!dto.email) {
      throw new BadRequestException('Email is required for payment processing');
    }

    if (!Types.ObjectId.isValid(dto.userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
  }

  /**
   * Get and validate user's cart with comprehensive error handling
   */
  private async getValidatedCart(userId: string): Promise<any> {
    // Find cart using multiple strategies
    const cartData = await this.findUserCart(userId);

    if (!cartData) {
      throw new NotFoundException('No cart found. Please add items to your cart first.');
    }

    if (!cartData.items || cartData.items.length === 0) {
      throw new NotFoundException('Cart is empty. Please add items to your cart before proceeding to payment.');
    }

    // Validate cart items
    this.validateCartItems(cartData.items);

    return cartData;
  }

  /**
   * Find user's cart using multiple query strategies
   */
  private async findUserCart(userId: string): Promise<any> {
    const userIdObj = new Types.ObjectId(userId);
    let cartExists = null;
    let actualUserId = null;

    // Strategy 1: Query with ObjectId
    cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userIdObj }).lean();
    if (cartExists) {
      actualUserId = cartExists.userId;
    } else {
      // Strategy 2: Query with string userId
      cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userId }).lean();
      if (cartExists) {
        actualUserId = cartExists.userId;
      } else {
        // Strategy 3: Query with multiple formats
        cartExists = await this.orderService.cartService.cartModel.findOne({ 
          userId: { $in: [userIdObj, userId, userIdObj.toString()] }
        }).lean();
        if (cartExists) {
          actualUserId = cartExists.userId;
        }
      }
    }

    if (!actualUserId) {
      return null;
    }

    // Get full cart data using the found userId format
    return this.orderService.cartService.getFullCart(actualUserId);
  }

  /**
   * Validate cart items for payment processing
   */
  private validateCartItems(items: any[]): void {
    const invalidItems = items.filter(item => 
      !item.priceSnapshot || 
      item.priceSnapshot <= 0 || 
      !item.total || 
      item.total <= 0 ||
      !item.quantity ||
      item.quantity <= 0
    );

    if (invalidItems.length > 0) {
      this.logger.error('Invalid cart items found:', invalidItems);
      throw new BadRequestException('Some items in your cart have invalid prices or quantities. Please refresh your cart and try again.');
    }
  }

  /**
   * Generate unique payment reference
   */
  private generatePaymentReference(userId: string): string {
    return `TXN-${Date.now()}-${userId}`;
  }

  /**
   * Build Paystack payment payload
   */
  private buildPaystackPayload(dto: any, cartData: any, reference: string): any {
    const subtotal = cartData.items.reduce((sum: number, item) => sum + Number(item.total), 0);
    const totalWithShipping = cartData.totalWithShipping;
    const shippingFee = totalWithShipping - subtotal;

    // Validate minimum amount
    if (totalWithShipping < 1) {
      throw new BadRequestException('Transaction amount must be at least ₦1');
    }

    return {
      email: dto.email,
      amount: Math.round(totalWithShipping * 100), // Convert to kobo
      currency: 'NGN',
      reference: reference,
      callback_url: process.env.PAYMENT_CALLBACK_URL,
      metadata: {
        userId: dto.userId,
        cartItemsCount: cartData.items.length,
        subtotal: subtotal,
        shippingFee: shippingFee,
        custom_fields: [
          {
            display_name: "Cart Items",
            variable_name: "cart_items_count",
            value: cartData.items.length.toString()
          },
          {
            display_name: "Shipping Fee",
            variable_name: "shipping_fee", 
            value: shippingFee.toString()
          }
        ]
      }
    };
  }

  /**
   * Log payment details for debugging
   */
  private logPaymentDetails(cartData: any, paystackPayload: any): void {
    const subTotal = cartData.items.reduce((sum: number, item) => sum + Number(item.total), 0);
    const shippingFee = cartData.totalWithShipping - subTotal;

    this.logger.log(`Payment breakdown for user ${paystackPayload.metadata.userId}:`);
    this.logger.log(`- Subtotal: ₦${subTotal}`);
    this.logger.log(`- Shipping: ₦${shippingFee}`);
    this.logger.log(`- Total: ₦${cartData.totalWithShipping}`);
    this.logger.log(`- Amount to Paystack (kobo): ${paystackPayload.amount}`);
  }

  /**
   * Handle successful payment webhook
   */
  private async handleSuccessfulPayment(data: any): Promise<void> {
    const reference = data.reference;
    this.logger.log(`Processing successful payment - Ref: ${reference}, Amount: ₦${data.amount / 100}`);

    try {
      const verification = await this.verifyTransaction(reference);

      if (verification.status && verification.data.status === 'success') {
        await this.orderService.markOrderAsPaid(reference);
        this.logger.log(`Order processed successfully for reference: ${reference}`);
      } else {
        this.logger.warn(`Payment verification failed for reference: ${reference}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process successful payment for reference ${reference}:`, error.message);
      // Don't throw here to avoid webhook failures
    }
  }

  /**
   * Call Paystack API with proper error handling
   */
  private async callPaystackAPI(endpoint: string, payload?: any): Promise<any> {
    try {
      const config = {
        headers: this.buildHeaders(),
      };

      const response = await firstValueFrom(
        payload 
          ? this.httpService.post(`${this.baseUrl}${endpoint}`, payload, config)
          : this.httpService.get(`${this.baseUrl}${endpoint}`, config)
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Paystack API call failed for ${endpoint}:`, {
        error: error.message,
        response: error.response?.data || null
      });
      throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
    }
  }

  /**
   * Verify transaction with Paystack
   */
  private async verifyTransaction(reference: string): Promise<any> {
    try {
      const response = await this.callPaystackAPI(`/transaction/verify/${reference}`);
      
      if (response.status && response.data) {
        this.logger.log(`Transaction verified - Ref: ${reference}, Amount: ₦${response.data.amount / 100}, Status: ${response.data.status}`);
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Transaction verification failed for ${reference}:`, error.message);
      return { status: false };
    }
  }

  /**
   * Build headers for Paystack API calls
   */
  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.paystackSecret}`,
      'Content-Type': 'application/json',
    };
  }
}