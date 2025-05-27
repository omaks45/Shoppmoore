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
   * Initialize payment transaction with Paystack (Fixed with better error handling)
   */
  async initializeTransaction(dto: InitializeTransactionDto & { email: string, userId: string }): Promise<PaystackInitResponse> {
    this.logger.log(`Initializing transaction for user: ${dto.userId}`);

    try {
      // Quick validations first (fail fast)
      this.validateEnvironmentConfig();
      this.validateTransactionInput(dto);

      // Get cached cart or fetch new data
      const cartData = await this.getCachedCart(dto.userId);
      
      // Validate cart data structure
      if (!cartData || typeof cartData !== 'object') {
        throw new BadRequestException('Invalid cart data structure');
      }

      // Generate payment reference with additional validation
      const reference = this.generatePaymentReference(dto.userId);
      if (!reference) {
        throw new BadRequestException('Failed to generate payment reference');
      }
      
      // Build payload with validation
      const paystackPayload = this.buildPaystackPayload(dto, cartData, reference);
      
      // Log payload for debugging (remove sensitive data)
      this.logger.debug(`Paystack payload: ${JSON.stringify({
        ...paystackPayload,
        email: paystackPayload.email ? '***' : 'missing'
      })}`);
      
      // Make API call with timeout and retry logic
      const response = await this.callPaystackAPIWithRetry('/transaction/initialize', paystackPayload);

      // Enhanced response validation
      if (!response) {
        throw new BadRequestException('Empty response from payment gateway');
      }

      if (!response.status) {
        this.logger.error('Paystack response missing status:', response);
        throw new BadRequestException('Invalid response format from payment gateway');
      }

      if (!response.data) {
        this.logger.error('Paystack response missing data field:', response);
        throw new BadRequestException('Payment gateway returned no data');
      }

      if (!response.data.authorization_url) {
        this.logger.error('Paystack response missing authorization_url:', response.data);
        throw new BadRequestException('Payment gateway did not provide authorization URL');
      }

      if (!response.data.reference) {
        this.logger.error('Paystack response missing reference:', response.data);
        throw new BadRequestException('Payment gateway did not return transaction reference');
      }

      this.logger.log(`Transaction initialized successfully. Reference: ${response.data.reference}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Payment initialization failed for user ${dto.userId}:`, {
        error: error.message,
        stack: error.stack,
        userId: dto.userId,
        email: dto.email,
        // Log additional context in production
        environment: process.env.NODE_ENV,
        paystackConfigured: !!this.paystackSecret
      });
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Payment initialization failed: ${error.message || 'Service temporarily unavailable'}`);
    }
  }

  /**
   * Handle Paystack webhooks (Enhanced error handling)
   */
  async handleWebhook(payload: any): Promise<void> {
    try {
      if (!payload || typeof payload !== 'object') {
        this.logger.error('Invalid webhook payload received:', payload);
        return;
      }

      const { event, data } = payload;

      if (!event || !data) {
        this.logger.error('Webhook payload missing required fields:', { event, hasData: !!data });
        return;
      }

      if (event === 'charge.success') {
        // Process asynchronously to avoid blocking webhook response
        setImmediate(() => this.handleSuccessfulPayment(data).catch(error => 
          this.logger.error('Async webhook processing failed:', error)
        ));
      }
    } catch (error) {
      this.logger.error('Webhook handling error:', error);
    }
  }

  /**
   * Verify transaction by reference (Enhanced validation)
   */
  async verifyTransactionByReference(reference: string): Promise<any> {
    try {
      if (!reference || typeof reference !== 'string') {
        throw new BadRequestException('Invalid transaction reference');
      }

      const verification = await this.callPaystackAPIWithRetry(`/transaction/verify/${reference}`);
      
      if (verification?.status && verification?.data) {
        this.logger.log(`Transaction verified - Ref: ${reference}, Amount: ₦${verification.data.amount / 100}`);
      } else {
        this.logger.warn(`Transaction verification returned unexpected response for ${reference}:`, verification);
      }
      
      return verification;
    } catch (error) {
      this.logger.error(`Transaction verification failed for ${reference}:`, error.message);
      throw new BadRequestException('Transaction verification failed');
    }
  }

  /**
   * Get cart total with enhanced validation
   */
  async getCartTotal(userId: string): Promise<{ subtotal: number; shipping: number; total: number }> {
    try {
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID for cart total calculation');
      }

      const cartData = await this.getCachedCart(userId);
      
      if (!cartData?.items?.length) {
        return { subtotal: 0, shipping: 750, total: 750 };
      }

      // Enhanced validation for cart items
      const validItems = cartData.items.filter(item => 
        item && typeof item === 'object' && typeof item.total === 'number'
      );

      if (validItems.length !== cartData.items.length) {
        this.logger.warn(`Cart contains ${cartData.items.length - validItems.length} invalid items for user ${userId}`);
      }

      // Use reduce with initial value for better performance
      const subtotal = validItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
      const total = cartData.totalWithShipping || (subtotal + 750);
      const shipping = total - subtotal;

      return { subtotal, shipping, total };
    } catch (error) {
      this.logger.error(`Error getting cart total for user ${userId}:`, error.message);
      return { subtotal: 0, shipping: 750, total: 750 };
    }
  }

  /**
   * Verify webhook signature (Enhanced security)
   */
  verifySignature(req: any): boolean {
    try {
      if (!this.paystackSecret) {
        this.logger.error('Paystack secret key not configured for signature verification');
        return false;
      }

      if (!req.headers || !req.headers['x-paystack-signature']) {
        this.logger.warn('Missing Paystack signature header');
        return false;
      }

      if (!req.rawBody) {
        this.logger.warn('Missing raw body for signature verification');
        return false;
      }

      const hash = crypto
        .createHmac('sha512', this.paystackSecret)
        .update(req.rawBody)
        .digest('hex');

      const isValid = hash === req.headers['x-paystack-signature'];
      
      if (!isValid) {
        this.logger.warn('Webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Signature verification error:', error.message);
      return false;
    }
  }

  /** ================== PRIVATE METHODS (ENHANCED) ================== */

  /**
   * Get cached cart data or fetch fresh (Enhanced error handling)
   */
  private async getCachedCart(userId: string): Promise<any> {
    const cacheKey = `cart_${userId}`;
    const cached = this.cartCache.get(cacheKey);
    
    // Return cached data if valid
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      this.logger.debug(`Using cached cart data for user ${userId}`);
      return cached.data;
    }

    // Fetch fresh data
    this.logger.debug(`Fetching fresh cart data for user ${userId}`);
    const cartData = await this.findUserCartOptimized(userId);
    
    if (!cartData) {
      throw new NotFoundException('Cart not found. Please add items to your cart first.');
    }

    if (!cartData.items || !Array.isArray(cartData.items) || cartData.items.length === 0) {
      throw new NotFoundException('Cart is empty. Please add items before proceeding.');
    }

    // Validate cart data structure
    if (typeof cartData.totalWithShipping !== 'number' || cartData.totalWithShipping <= 0) {
      this.logger.error(`Invalid cart total for user ${userId}:`, cartData);
      throw new BadRequestException('Invalid cart total calculation');
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
   * Optimized cart lookup with enhanced error handling
   */
  private async findUserCartOptimized(userId: string): Promise<any> {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required for cart lookup');
      }

      let userIdObj: Types.ObjectId;
      try {
        userIdObj = new Types.ObjectId(userId);
      } catch (error) {
        this.logger.error(`Invalid user ID format: ${userId}`, error);
        throw new BadRequestException('Invalid user ID format');
      }
      
      // Single query with multiple conditions - more efficient
      const cart = await this.orderService.cartService.cartModel
        .findOne({ 
          userId: { $in: [userIdObj, userId] }
        })
        .lean() // Use lean() for better performance
        .exec();

      if (!cart) {
        this.logger.warn(`No cart found for user ${userId}`);
        return null;
      }

      // Get full cart data using the most efficient method
      const fullCart = await this.orderService.cartService.getFullCart(cart.userId);
      
      if (!fullCart) {
        this.logger.warn(`Failed to get full cart data for user ${userId}`);
        return null;
      }

      return fullCart;
    } catch (error) {
      this.logger.error(`Error finding cart for user ${userId}:`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate payment reference with validation
   */
  private generatePaymentReference(userId: string): string {
    try {
      if (!userId) {
        throw new Error('User ID is required for reference generation');
      }

      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 6);
      const reference = `TXN-${timestamp}-${userId}-${randomPart}`;
      
      // Validate generated reference
      if (!reference || reference.length < 10) {
        throw new Error('Generated reference is too short');
      }

      return reference;
    } catch (error) {
      this.logger.error('Failed to generate payment reference:', error.message);
      throw new BadRequestException('Failed to generate payment reference');
    }
  }

  /**
   * Build Paystack payload with enhanced validation
   */
  private buildPaystackPayload(dto: any, cartData: any, reference: string): any {
    try {
      // Validate inputs
      if (!dto || !cartData || !reference) {
        throw new Error('Missing required parameters for payload building');
      }

      if (!cartData.items || !Array.isArray(cartData.items)) {
        throw new Error('Invalid cart items structure');
      }

      const subtotal = cartData.items.reduce((sum: number, item: any) => {
        if (!item || typeof item.total !== 'number') {
          this.logger.warn('Invalid cart item found:', item);
          return sum;
        }
        return sum + item.total;
      }, 0);

      const totalWithShipping = cartData.totalWithShipping;
      
      if (typeof totalWithShipping !== 'number' || totalWithShipping <= 0) {
        throw new Error('Invalid total amount');
      }

      const shippingFee = totalWithShipping - subtotal;

      // Validate amounts
      if (totalWithShipping < 100) { // Minimum 1 naira in kobo
        throw new BadRequestException('Transaction amount too low');
      }

      // Validate email
      if (!dto.email || typeof dto.email !== 'string') {
        throw new Error('Invalid email address');
      }

      const payload = {
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

      // Final validation
      if (!payload.email || !payload.amount || !payload.reference) {
        throw new Error('Payload validation failed - missing required fields');
      }

      return payload;
    } catch (error) {
      this.logger.error('Error building Paystack payload:', error.message);
      throw new BadRequestException(`Failed to build payment request: ${error.message}`);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of this.cartCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cartCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Validate environment (Enhanced validation)
   */
  private static envValidated = false;
  private validateEnvironmentConfig(): void {
    if (PaymentService.envValidated) return;

    if (!this.paystackSecret) {
      throw new BadRequestException('Paystack secret key not configured');
    }

    if (!this.paystackSecret.startsWith('sk_')) {
      throw new BadRequestException('Invalid Paystack secret key format');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isLiveKey = this.paystackSecret.startsWith('sk_live_');

    if (isProduction && !isLiveKey) {
      throw new BadRequestException('Production requires live secret key');
    }

    if (!isProduction && isLiveKey) {
      this.logger.warn('Using live Paystack key in non-production environment');
    }

    PaymentService.envValidated = true;
    this.logger.log('Environment configuration validated successfully');
  }

  /**
   * Enhanced input validation
   */
  private validateTransactionInput(dto: any): void {
    if (!dto) {
      throw new BadRequestException('Transaction data is required');
    }

    if (!dto.userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!Types.ObjectId.isValid(dto.userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    if (!dto.email) {
      throw new BadRequestException('Email is required');
    }

    if (typeof dto.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }
  }

  /**
   * Handle successful payment (Enhanced error handling)
   */
  private async handleSuccessfulPayment(data: any): Promise<void> {
    try {
      if (!data || !data.reference) {
        this.logger.error('Invalid payment data received:', data);
        return;
      }

      const reference = data.reference;
      
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
      } else {
        this.logger.warn(`Payment verification failed for reference ${reference}:`, verification);
      }
    } catch (error) {
      this.logger.error(`Failed to process payment for reference ${data?.reference}:`, error.message);
    }
  }

  /**
   * Paystack API call with enhanced error handling and retry logic
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

        this.logger.debug(`Making Paystack API call to ${endpoint} (attempt ${attempt + 1})`);

        const response = await firstValueFrom(
          payload 
            ? this.httpService.post(`${this.baseUrl}${endpoint}`, payload, config)
            : this.httpService.get(`${this.baseUrl}${endpoint}`, config)
        );

        if (!response || !response.data) {
          throw new Error('Empty response from Paystack API');
        }

        this.logger.debug(`Paystack API call successful for ${endpoint}`);
        return response.data;
      } catch (error) {
        lastError = error;
        
        this.logger.warn(`Paystack API call failed (attempt ${attempt + 1}):`, {
          endpoint,
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        
        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.debug(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Enhanced error handling
    const status = lastError.response?.status;
    const errorData = lastError.response?.data;
    
    this.logger.error(`All Paystack API retry attempts failed for ${endpoint}:`, {
      status,
      error: lastError.message,
      data: errorData
    });

    if (status === 401) {
      throw new BadRequestException('Payment service authentication failed');
    } else if (status === 400) {
      const message = errorData?.message || 'Invalid payment request';
      throw new BadRequestException(`Payment error: ${message}`);
    } else if (status >= 500) {
      throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
    } else if (lastError.code === 'ECONNABORTED' || lastError.code === 'ETIMEDOUT') {
      throw new BadRequestException('Payment service timeout. Please try again.');
    } else {
      throw new BadRequestException(`Payment service error: ${lastError.message || 'Service temporarily unavailable'}`);
    }
  }
}