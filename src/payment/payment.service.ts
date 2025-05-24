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

  async initializeTransaction(dto: InitializeTransactionDto & { email: string, userId: string }): Promise<PaystackInitResponse> {
    this.logger.log(`Initializing transaction for: ${dto.email}`);
  
    // DEBUG: Log the incoming DTO to see what we're receiving
    this.logger.log(`Full DTO received:`, {
      email: dto.email,
      userId: dto.userId,
      dtoKeys: Object.keys(dto),
      dtoValues: dto
    });

    // Validate userId first
    if (!dto.userId) {
      this.logger.error('UserId is missing from DTO');
      throw new BadRequestException('User ID is required for payment processing');
    }

    // Get user's FULL cart (not paginated) with populated product data
    const userIdObj = new Types.ObjectId(dto.userId);
    this.logger.log(`Converting userId to ObjectId: ${dto.userId} -> ${userIdObj}`);

    // DEBUG: Check if cart exists in database directly
    const cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userIdObj });
    this.logger.log(`Direct cart query result:`, {
      cartExists: !!cartExists,
      cartId: cartExists?._id,
      cartUserId: cartExists?.userId,
      rawItemsCount: cartExists?.items?.length || 0,
      rawItems: cartExists?.items || []
    });

    const cartData = await this.orderService.cartService.getFullCart(userIdObj);

    // Enhanced logging to debug the cart data
    this.logger.log(`Cart data for user ${dto.userId}:`, {
      hasCartData: !!cartData,
      itemsCount: cartData?.items?.length || 0,
      items: cartData?.items || [],
      totalWithShipping: cartData?.totalWithShipping,
      cartUserId: cartData?.userId
    });

    // Additional check: Log each item in detail if cart has items
    if (cartData?.items && cartData.items.length > 0) {
      cartData.items.forEach((item, index) => {
        this.logger.log(`Cart item ${index}:`, {
          productId: item.productId,
          quantity: item.quantity,
          priceSnapshot: item.priceSnapshot,
          total: item.total
        });
      });
    }

    if (!cartData || !cartData.items || cartData.items.length === 0) {
      this.logger.warn(`Empty cart detected for user ${dto.userId}`);
      throw new NotFoundException('Cart is empty. Please add items to your cart before proceeding to payment.');
    }

    // Rest of your code remains the same...
    // Validate that all cart items have valid prices
    const invalidItems = cartData.items.filter(item => 
      !item.priceSnapshot || item.priceSnapshot <= 0 || !item.total || item.total <= 0
    );

    if (invalidItems.length > 0) {
      this.logger.error(`Invalid cart items found for user ${dto.userId}:`, invalidItems);
      throw new BadRequestException('Some items in your cart have invalid prices. Please refresh your cart and try again.');
    }

    // Calculate total using the cart service method
    const totalWithShipping = cartData.totalWithShipping;
  
    // Log the breakdown for debugging
    const subTotal = cartData.items.reduce((sum: number, item) => sum + Number(item.total), 0);
    const shippingFee = totalWithShipping - subTotal;
  
    this.logger.log(`Payment breakdown for user ${dto.userId}:`);
    this.logger.log(`- Subtotal: ₦${subTotal}`);
    this.logger.log(`- Shipping: ₦${shippingFee}`);
    this.logger.log(`- Total: ₦${totalWithShipping}`);
    this.logger.log(`- Amount to Paystack (kobo): ${totalWithShipping * 100}`);

    // Validate minimum amount (Paystack minimum is usually 1 Naira = 100 kobo)
    if (totalWithShipping < 1) {
      throw new BadRequestException('Transaction amount must be at least ₦1');
    }

    try {
      const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: dto.email,
          amount: Math.round(totalWithShipping * 100), // convert to kobo and round to avoid decimals
          currency: 'NGN', // Explicitly set currency
          reference: `TXN-${Date.now()}-${dto.userId}`, // Generate unique reference
          callback_url: process.env.PAYMENT_CALLBACK_URL, // Optional: set callback URL
          metadata: {
            userId: dto.userId,
            cartItemsCount: cartData.items.length,
            subtotal: subTotal,
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
        },
        {
          headers: this.buildHeaders(),
        },
      ),
    );

    this.logger.log(`Transaction initialized successfully. Reference: ${response.data.data?.reference}`);
    return response.data;

    } catch (error) {
      this.logger.error(`Failed to initialize transaction for user ${dto.userId}:`, error.response?.data || error.message);
      throw new BadRequestException('Failed to initialize payment. Please try again.');
    }
  } 
  /**
   * Handles webhook and verifies transaction
   */
  async handleWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event === 'charge.success') {
      const reference = data.reference;
      this.logger.log(`Webhook received: charge.success - Ref: ${reference}`);
      this.logger.log(`Transaction amount: ₦${data.amount / 100}`); // Log amount for verification

      const verification = await this.verifyTransaction(reference);

      if (verification.status && verification.data.status === 'success') {
        try {
          await this.orderService.markOrderAsPaid(reference);
          this.logger.log(`Order updated for reference: ${reference} - Amount: ₦${verification.data.amount / 100}`);
        } catch (err) {
          this.logger.error(`Failed to mark order as paid: ${err.message}`);
        }
      } else {
        this.logger.warn(`Transaction verification failed for ${reference}`);
      }
    } else {
      this.logger.debug(`Webhook ignored for event: ${event}`);
    }
  }

  /**
   * Verifies the transaction using Paystack API
   */
  private async verifyTransaction(reference: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/transaction/verify/${reference}`, {
          headers: this.buildHeaders(),
        }),
      );
      
      // Log transaction details for debugging
      if (response.data.status && response.data.data) {
        this.logger.log(`Transaction verified - Ref: ${reference}, Amount: ₦${response.data.data.amount / 100}, Status: ${response.data.data.status}`);
      }
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error verifying transaction: ${reference} - ${error.message}`);
      return { status: false };
    }
  }

  /**
   * Build headers for Paystack requests
   */
  private buildHeaders() {
    return {
      Authorization: `Bearer ${this.paystackSecret}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Verifies webhook signature using Paystack secret key
   */
  verifySignature(req: any): boolean {
    const hash = crypto
      .createHmac('sha512', this.paystackSecret)
      .update(req.rawBody)
      .digest('hex');

    const signature = req.headers['x-paystack-signature'];
    const valid = hash === signature;

    if (!valid) {
      this.logger.warn('Invalid Paystack signature');
    }

    return valid;
  }

  // Verifies transaction by reference and logs the result
  async verifyTransactionByReference(reference: string): Promise<any> {
    const verification = await this.verifyTransaction(reference);
  
    if (!verification.status) {
      this.logger.warn(`Transaction not found or failed: ${reference}`);
    }
  
    return verification;
  }

  // Helper method to get cart total for external use
  async getCartTotal(userId: string): Promise<{ subtotal: number; shipping: number; total: number }> {
    const userIdObj = new Types.ObjectId(userId);
    const cartData = await this.orderService.cartService.getFullCart(userIdObj); // Use getFullCart here too
    
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      return { subtotal: 0, shipping: 750, total: 750 }; // Return shipping fee even for empty cart
    }

    const subtotal = cartData.items.reduce((sum, item) => sum + item.total, 0);
    const total = cartData.totalWithShipping;
    const shipping = total - subtotal;

    return { subtotal, shipping, total };
  }
}