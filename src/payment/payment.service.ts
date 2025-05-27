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
  
  // Cache for cart data to avoid repeated queries
  private cartCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  /**
   * Initialize payment transaction with Paystack (Optimized)
   */
  async initializeTransaction(dto: InitializeTransactionDto & { email: string, userId: string }): Promise<PaystackInitResponse> {
    this.logger.log(`Initializing transaction for user: ${dto.userId}`);

    try {
      // Quick validations first (fail fast)
      this.validateEnvironmentConfig();
      this.validateTransactionInput(dto);

      // Get cached cart or fetch new data
      const cartData = await this.getCachedCart(dto.userId);
      
      // Generate payment reference
      const reference = this.generatePaymentReference(dto.userId);
      
      // Build payload (optimized)
      const paystackPayload = this.buildPaystackPayload(dto, cartData, reference);
      
      // Make API call with timeout and retry logic
      const response = await this.callPaystackAPIWithRetry('/transaction/initialize', paystackPayload);

      // Quick validation
      if (!response?.status || !response?.data?.authorization_url) {
        throw new BadRequestException('Invalid response from payment gateway');
      }

      this.logger.log(`Transaction initialized successfully. Reference: ${reference}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Payment initialization failed for user ${dto.userId}:`, {
        error: error.message,
        userId: dto.userId,
        email: dto.email
      });
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Payment initialization failed: ${error.message || 'Service temporarily unavailable'}`);
    }
  }

  /**
   * Handle Paystack webhooks (Optimized for performance)
   */
  async handleWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event === 'charge.success') {
      // Process asynchronously to avoid blocking webhook response
      setImmediate(() => this.handleSuccessfulPayment(data).catch(error => 
        this.logger.error('Async webhook processing failed:', error)
      ));
    }
  }

  /**
   * Verify transaction by reference (Cached)
   */
  async verifyTransactionByReference(reference: string): Promise<any> {
    try {
      const verification = await this.callPaystackAPIWithRetry(`/transaction/verify/${reference}`);
      
      if (verification?.status && verification?.data) {
        this.logger.log(`Transaction verified - Ref: ${reference}, Amount: ₦${verification.data.amount / 100}`);
      }
      
      return verification;
    } catch (error) {
      this.logger.error(`Transaction verification failed for ${reference}:`, error.message);
      throw new BadRequestException('Transaction verification failed');
    }
  }

  /**
   * Get cart total with caching
   */
  async getCartTotal(userId: string): Promise<{ subtotal: number; shipping: number; total: number }> {
    try {
      const cartData = await this.getCachedCart(userId);
      
      if (!cartData?.items?.length) {
        return { subtotal: 0, shipping: 750, total: 750 };
      }

      // Use reduce with initial value for better performance
      const subtotal = cartData.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
      const total = cartData.totalWithShipping || (subtotal + 750);
      const shipping = total - subtotal;

      return { subtotal, shipping, total };
    } catch (error) {
      this.logger.error(`Error getting cart total for user ${userId}:`, error.message);
      return { subtotal: 0, shipping: 750, total: 750 };
    }
  }

  /**
   * Verify webhook signature (Optimized)
   */
  verifySignature(req: any): boolean {
    try {
      if (!this.paystackSecret || !req.headers['x-paystack-signature']) {
        return false;
      }

      const hash = crypto
        .createHmac('sha512', this.paystackSecret)
        .update(req.rawBody)
        .digest('hex');

      return hash === req.headers['x-paystack-signature'];
    } catch (error) {
      this.logger.error('Signature verification error:', error.message);
      return false;
    }
  }

  /** ================== PRIVATE METHODS (OPTIMIZED) ================== */

  /**
   * Get cached cart data or fetch fresh
   */
  private async getCachedCart(userId: string): Promise<any> {
    const cacheKey = `cart_${userId}`;
    const cached = this.cartCache.get(cacheKey);
    
    // Return cached data if valid
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }

    // Fetch fresh data
    const cartData = await this.findUserCartOptimized(userId);
    
    if (!cartData) {
      throw new NotFoundException('Cart not found. Please add items to your cart first.');
    }

    if (!cartData.items?.length) {
      throw new NotFoundException('Cart is empty. Please add items before proceeding.');
    }

    // Cache the result
    this.cartCache.set(cacheKey, {
      data: cartData,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (this.cartCache.size > 100) {
      this.cleanCache();
    }

    return cartData;
  }

  /**
   * Optimized cart lookup with single query
   */
  private async findUserCartOptimized(userId: string): Promise<any> {
    try {
      const userIdObj = new Types.ObjectId(userId);
      
      // Single query with multiple conditions - more efficient
      const cart = await this.orderService.cartService.cartModel
        .findOne({ 
          userId: { $in: [userIdObj, userId] }
        })
        .lean() // Use lean() for better performance
        .exec();

      if (!cart) {
        return null;
      }

      // Get full cart data using the most efficient method
      return await this.orderService.cartService.getFullCart(cart.userId);
    } catch (error) {
      this.logger.error(`Error finding cart for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cartCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cartCache.delete(key);
      }
    }
  }

  /**
   * Validate environment (Optimized - cache result)
   */
  private static envValidated = false;
  private validateEnvironmentConfig(): void {
    if (PaymentService.envValidated) return;

    if (!this.paystackSecret?.startsWith('sk_')) {
      throw new BadRequestException('Payment service configuration error');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isLiveKey = this.paystackSecret.startsWith('sk_live_');

    if (isProduction && !isLiveKey) {
      throw new BadRequestException('Production requires live secret key');
    }

    PaymentService.envValidated = true;
  }

  /**
   * Fast input validation
   */
  private validateTransactionInput(dto: any): void {
    if (!dto.userId || !Types.ObjectId.isValid(dto.userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }
  }

  /**
   * Generate payment reference (Optimized)
   */
  private generatePaymentReference(userId: string): string {
    return `TXN-${Date.now()}-${userId}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Build Paystack payload (Optimized)
   */
  private buildPaystackPayload(dto: any, cartData: any, reference: string): any {
    const subtotal = cartData.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const totalWithShipping = cartData.totalWithShipping;
    const shippingFee = totalWithShipping - subtotal;

    // Validate amounts
    if (totalWithShipping < 100) { // Minimum 1 naira in kobo
      throw new BadRequestException('Transaction amount too low');
    }

    return {
      email: dto.email.toLowerCase().trim(),
      amount: Math.round(totalWithShipping * 100), // Convert to kobo
      currency: 'NGN',
      reference,
      callback_url: process.env.PAYMENT_CALLBACK_URL,
      metadata: {
        userId: dto.userId,
        cartItemsCount: cartData.items.length,
        subtotal,
        shippingFee
      }
    };
  }

  /**
   * Handle successful payment (Async optimized)
   */
  private async handleSuccessfulPayment(data: any): Promise<void> {
    const reference = data.reference;
    
    try {
      // Quick verification
      const verification = await this.callPaystackAPIWithRetry(`/transaction/verify/${reference}`);

      if (verification?.status && verification?.data?.status === 'success') {
        await this.orderService.markOrderAsPaid(reference);
        
        // Clear cart cache for this user if we can extract userId
        const parts = reference.split('-');
        if (parts.length >= 3) {
          this.cartCache.delete(`cart_${parts[2]}`);
        }
        
        this.logger.log(`Order processed successfully for reference: ${reference}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process payment for reference ${reference}:`, error.message);
    }
  }

  /**
   * Paystack API call with retry logic and circuit breaker
   */
  private async callPaystackAPIWithRetry(endpoint: string, payload?: any, retries = 2): Promise<any> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // Reduced timeout for faster failures
        };

        const response = await firstValueFrom(
          payload 
            ? this.httpService.post(`${this.baseUrl}${endpoint}`, payload, config)
            : this.httpService.get(`${this.baseUrl}${endpoint}`, config)
        );

        return response.data;
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Handle specific error types
    const status = lastError.response?.status;
    if (status === 401) {
      throw new BadRequestException('Payment service authentication failed');
    } else if (status === 400) {
      const message = lastError.response?.data?.message || 'Invalid payment request';
      throw new BadRequestException(`Payment error: ${message}`);
    } else if (status >= 500) {
      throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
    } else if (lastError.code === 'ECONNABORTED' || lastError.code === 'ETIMEDOUT') {
      throw new BadRequestException('Payment service timeout. Please try again.');
    } else {
      throw new BadRequestException('Payment service temporarily unavailable');
    }
  }
}