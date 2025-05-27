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
   * Initialize payment transaction with Paystack (Enhanced with comprehensive debugging)
   */
  async initializeTransaction(dto: InitializeTransactionDto & { email: string, userId: string }): Promise<PaystackInitResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    this.logger.log(`[${requestId}] Starting transaction initialization for user: ${dto.userId}`);
    this.logger.log(`[${requestId}] Environment: ${process.env.NODE_ENV}`);
    this.logger.log(`[${requestId}] Paystack key type: ${this.paystackSecret?.substring(0, 8)}...`);

    try {
      // Enhanced validation with detailed logging
      this.validateEnvironmentConfig(requestId);
      this.validateTransactionInput(dto, requestId);

      // Get cached cart or fetch new data
      this.logger.log(`[${requestId}] Fetching cart data for user: ${dto.userId}`);
      const cartData = await this.getCachedCart(dto.userId, requestId);
      
      this.logger.log(`[${requestId}] Cart data retrieved:`, {
        hasItems: !!cartData?.items,
        itemCount: cartData?.items?.length || 0,
        totalWithShipping: cartData?.totalWithShipping,
        cartDataKeys: Object.keys(cartData || {})
      });

      // Validate cart data structure
      if (!cartData || typeof cartData !== 'object') {
        this.logger.error(`[${requestId}] Invalid cart data structure:`, cartData);
        throw new BadRequestException('Invalid cart data structure');
      }

      // Generate payment reference with additional validation
      const reference = this.generatePaymentReference(dto.userId, requestId);
      this.logger.log(`[${requestId}] Generated payment reference: ${reference}`);
      
      // Build payload with validation
      const paystackPayload = this.buildPaystackPayload(dto, cartData, reference, requestId);
      
      // Log payload for debugging (sanitized)
      this.logger.log(`[${requestId}] Paystack payload prepared:`, {
        email: paystackPayload.email ? `${paystackPayload.email.substring(0, 3)}***` : 'missing',
        amount: paystackPayload.amount,
        currency: paystackPayload.currency,
        reference: paystackPayload.reference,
        hasMetadata: !!paystackPayload.metadata
      });
      
      // Make API call with enhanced logging
      this.logger.log(`[${requestId}] Making API call to Paystack...`);
      const response = await this.callPaystackAPIWithRetry('/transaction/initialize', paystackPayload, 2, requestId);

      // COMPREHENSIVE response validation with detailed logging
      this.logger.log(`[${requestId}] Raw Paystack response:`, {
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
        status: response?.status,
        hasData: !!response?.data,
        dataType: typeof response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : []
      });

      // Log the full response structure (sanitized) for debugging
      if (response) {
        this.logger.debug(`[${requestId}] Full response structure:`, JSON.stringify({
          ...response,
          data: response.data ? {
            ...response.data,
            authorization_url: response.data.authorization_url ? 'present' : 'missing',
            reference: response.data.reference ? 'present' : 'missing'
          } : 'missing'
        }, null, 2));
      }

      if (!response) {
        this.logger.error(`[${requestId}] Empty response from payment gateway`);
        throw new BadRequestException('Empty response from payment gateway');
      }

      if (!response.status) {
        this.logger.error(`[${requestId}] Paystack response missing status field:`, response);
        throw new BadRequestException('Invalid response format from payment gateway - missing status');
      }

      if (!response.data) {
        this.logger.error(`[${requestId}] Paystack response missing data field:`, {
          response,
          hasStatus: !!response.status,
          statusValue: response.status
        });
        throw new BadRequestException('Payment gateway returned no data');
      }

      // Check if data is an object
      if (typeof response.data !== 'object') {
        this.logger.error(`[${requestId}] Paystack data field is not an object:`, {
          dataType: typeof response.data,
          dataValue: response.data
        });
        throw new BadRequestException('Invalid data format from payment gateway');
      }

      if (!response.data.authorization_url) {
        this.logger.error(`[${requestId}] Paystack response missing authorization_url:`, {
          dataKeys: Object.keys(response.data),
          authUrl: response.data.authorization_url
        });
        throw new BadRequestException('Payment gateway did not provide authorization URL');
      }

      if (!response.data.reference) {
        this.logger.error(`[${requestId}] Paystack response missing reference:`, {
          dataKeys: Object.keys(response.data),
          reference: response.data.reference,
          expectedReference: reference
        });
        throw new BadRequestException('Payment gateway did not return transaction reference');
      }

      this.logger.log(`[${requestId}] Transaction initialized successfully:`, {
        reference: response.data.reference,
        authUrl: response.data.authorization_url ? 'present' : 'missing'
      });

      return response.data;

    } catch (error) {
      this.logger.error(`[${requestId}] Payment initialization failed:`, {
        error: error.message,
        stack: error.stack,
        userId: dto.userId,
        email: dto.email,
        environment: process.env.NODE_ENV,
        paystackConfigured: !!this.paystackSecret,
        errorType: error.constructor.name
      });
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Payment initialization failed: ${error.message || 'Service temporarily unavailable'}`);
    }
  }

  /**
   * Enhanced cart fetching with detailed logging
   */
  private async getCachedCart(userId: string, requestId: string): Promise<any> {
    const cacheKey = `cart_${userId}`;
    const cached = this.cartCache.get(cacheKey);
    
    // Return cached data if valid
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      this.logger.debug(`[${requestId}] Using cached cart data for user ${userId}`);
      return cached.data;
    }

    // Fetch fresh data
    this.logger.log(`[${requestId}] Fetching fresh cart data for user ${userId}`);
    const cartData = await this.findUserCartOptimized(userId, requestId);
    
    if (!cartData) {
      this.logger.error(`[${requestId}] No cart found for user ${userId}`);
      throw new NotFoundException('Cart not found. Please add items to your cart first.');
    }

    if (!cartData.items || !Array.isArray(cartData.items) || cartData.items.length === 0) {
      this.logger.error(`[${requestId}] Cart is empty for user ${userId}:`, {
        hasItems: !!cartData.items,
        isArray: Array.isArray(cartData.items),
        itemCount: cartData.items?.length || 0
      });
      throw new NotFoundException('Cart is empty. Please add items before proceeding.');
    }

    // Validate cart data structure
    if (typeof cartData.totalWithShipping !== 'number' || cartData.totalWithShipping <= 0) {
      this.logger.error(`[${requestId}] Invalid cart total for user ${userId}:`, {
        totalWithShipping: cartData.totalWithShipping,
        totalType: typeof cartData.totalWithShipping,
        cartKeys: Object.keys(cartData)
      });
      throw new BadRequestException('Invalid cart total calculation');
    }

    // Cache the result
    this.cartCache.set(cacheKey, {
      data: cartData,
      timestamp: Date.now()
    });

    this.logger.log(`[${requestId}] Cart data cached successfully for user ${userId}`);
    return cartData;
  }

  /**
   * Enhanced cart lookup with detailed logging
   */
  private async findUserCartOptimized(userId: string, requestId: string): Promise<any> {
    try {
      this.logger.log(`[${requestId}] Starting cart lookup for user: ${userId}`);

      if (!userId) {
        throw new BadRequestException('User ID is required for cart lookup');
      }

      let userIdObj: Types.ObjectId;
      try {
        userIdObj = new Types.ObjectId(userId);
        this.logger.debug(`[${requestId}] User ID converted to ObjectId successfully`);
      } catch (error) {
        this.logger.error(`[${requestId}] Invalid user ID format: ${userId}`, error);
        throw new BadRequestException('Invalid user ID format');
      }
      
      // Check if orderService and cartService are available
      if (!this.orderService) {
        this.logger.error(`[${requestId}] OrderService not available`);
        throw new BadRequestException('Order service not available');
      }

      if (!this.orderService.cartService) {
        this.logger.error(`[${requestId}] CartService not available`);
        throw new BadRequestException('Cart service not available');
      }

      if (!this.orderService.cartService.cartModel) {
        this.logger.error(`[${requestId}] Cart model not available`);
        throw new BadRequestException('Cart model not available');
      }

      this.logger.log(`[${requestId}] Querying database for cart...`);
      
      // Single query with multiple conditions - more efficient
      const cart = await this.orderService.cartService.cartModel
        .findOne({ 
          userId: { $in: [userIdObj, userId] }
        })
        .lean() // Use lean() for better performance
        .exec();

      if (!cart) {
        this.logger.warn(`[${requestId}] No cart document found in database for user ${userId}`);
        return null;
      }

      this.logger.log(`[${requestId}] Cart document found, getting full cart data...`);

      // Get full cart data using the most efficient method
      const fullCart = await this.orderService.cartService.getFullCart(cart.userId);
      
      if (!fullCart) {
        this.logger.error(`[${requestId}] Failed to get full cart data for user ${userId}`);
        return null;
      }

      this.logger.log(`[${requestId}] Full cart data retrieved successfully`);
      return fullCart;

    } catch (error) {
      this.logger.error(`[${requestId}] Error finding cart for user ${userId}:`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Enhanced Paystack API call with comprehensive logging
   */
  private async callPaystackAPIWithRetry(endpoint: string, payload?: any, retries = 2, requestId?: string): Promise<any> {
    let lastError: any;
    const logId = requestId || `api_${Date.now()}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        };

        this.logger.log(`[${logId}] Making Paystack API call to ${endpoint} (attempt ${attempt + 1}/${retries + 1})`);

        const startTime = Date.now();
        const response = await firstValueFrom(
          payload 
            ? this.httpService.post(`${this.baseUrl}${endpoint}`, payload, config)
            : this.httpService.get(`${this.baseUrl}${endpoint}`, config)
        );
        const duration = Date.now() - startTime;

        this.logger.log(`[${logId}] Paystack API call completed in ${duration}ms`);

        if (!response) {
          this.logger.error(`[${logId}] Null response from HTTP service`);
          throw new Error('Null response from HTTP service');
        }

        if (!response.data) {
          this.logger.error(`[${logId}] Response missing data field:`, {
            hasResponse: !!response,
            responseKeys: Object.keys(response || {}),
            status: response?.status,
            statusText: response?.statusText
          });
          throw new Error('Response missing data field');
        }

        this.logger.log(`[${logId}] Paystack API call successful for ${endpoint}`);
        
        // Log response structure for debugging
        this.logger.debug(`[${logId}] Response structure:`, {
          dataKeys: Object.keys(response.data),
          status: response.status,
          statusText: response.statusText
        });

        return response.data;

      } catch (error) {
        lastError = error;
        
        const errorInfo = {
          endpoint,
          attempt: attempt + 1,
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code,
          responseData: error.response?.data
        };

        this.logger.error(`[${logId}] Paystack API call failed:`, errorInfo);
        
        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          this.logger.error(`[${logId}] Client error detected, not retrying`);
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.log(`[${logId}] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Enhanced error handling with detailed logging
    const status = lastError.response?.status;
    const errorData = lastError.response?.data;
    
    this.logger.error(`[${logId}] All Paystack API retry attempts failed for ${endpoint}:`, {
      status,
      error: lastError.message,
      data: errorData,
      code: lastError.code,
      totalAttempts: retries + 1
    });

    // Throw specific errors based on the failure type
    if (status === 401) {
      throw new BadRequestException('Payment service authentication failed - check API key');
    } else if (status === 400) {
      const message = errorData?.message || 'Invalid payment request';
      throw new BadRequestException(`Payment error: ${message}`);
    } else if (status >= 500) {
      throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
    } else if (lastError.code === 'ECONNABORTED' || lastError.code === 'ETIMEDOUT') {
      throw new BadRequestException('Payment service timeout. Please try again.');
    } else if (lastError.code === 'ECONNREFUSED') {
      throw new BadRequestException('Unable to connect to payment service. Please check your internet connection.');
    } else {
      throw new BadRequestException(`Payment service error: ${lastError.message || 'Service temporarily unavailable'}`);
    }
  }

  /**
   * Enhanced environment validation with detailed logging
   */
  private static envValidated = false;
  private validateEnvironmentConfig(requestId?: string): void {
    const logId = requestId || 'env_check';
    
    if (PaymentService.envValidated) {
      this.logger.debug(`[${logId}] Environment already validated`);
      return;
    }

    this.logger.log(`[${logId}] Validating environment configuration...`);

    if (!this.paystackSecret) {
      this.logger.error(`[${logId}] PAYSTACK_SECRET_KEY environment variable not set`);
      throw new BadRequestException('Paystack secret key not configured');
    }

    if (!this.paystackSecret.startsWith('sk_')) {
      this.logger.error(`[${logId}] Paystack secret key has invalid format: ${this.paystackSecret.substring(0, 5)}...`);
      throw new BadRequestException('Invalid Paystack secret key format');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isLiveKey = this.paystackSecret.startsWith('sk_live_');

    this.logger.log(`[${logId}] Environment details:`, {
      nodeEnv: process.env.NODE_ENV,
      isProduction,
      keyType: isLiveKey ? 'live' : 'test'
    });

    if (isProduction && !isLiveKey) {
      this.logger.error(`[${logId}] Production environment requires live secret key`);
      throw new BadRequestException('Production requires live secret key');
    }

    if (!isProduction && isLiveKey) {
      this.logger.warn(`[${logId}] Using live Paystack key in non-production environment`);
    }

    PaymentService.envValidated = true;
    this.logger.log(`[${logId}] Environment configuration validated successfully`);
  }

  /**
   * Enhanced input validation with detailed logging
   */
  private validateTransactionInput(dto: any, requestId?: string): void {
    const logId = requestId || 'input_validation';
    
    this.logger.debug(`[${logId}] Validating transaction input...`);

    if (!dto) {
      this.logger.error(`[${logId}] Transaction data is null or undefined`);
      throw new BadRequestException('Transaction data is required');
    }

    if (!dto.userId) {
      this.logger.error(`[${logId}] User ID is missing from dto:`, Object.keys(dto));
      throw new BadRequestException('User ID is required');
    }

    if (!Types.ObjectId.isValid(dto.userId)) {
      this.logger.error(`[${logId}] Invalid user ID format: ${dto.userId}`);
      throw new BadRequestException('Invalid user ID format');
    }

    if (!dto.email) {
      this.logger.error(`[${logId}] Email is missing from dto:`, Object.keys(dto));
      throw new BadRequestException('Email is required');
    }

    if (typeof dto.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      this.logger.error(`[${logId}] Invalid email format: ${dto.email}`);
      throw new BadRequestException('Invalid email format');
    }

    this.logger.debug(`[${logId}] Transaction input validation passed`);
  }

  /**
   * Generate payment reference with enhanced logging
   */
  private generatePaymentReference(userId: string, requestId?: string): string {
    const logId = requestId || 'ref_gen';
    
    try {
      this.logger.debug(`[${logId}] Generating payment reference for user: ${userId}`);

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

      this.logger.debug(`[${logId}] Payment reference generated successfully: ${reference}`);
      return reference;

    } catch (error) {
      this.logger.error(`[${logId}] Failed to generate payment reference:`, error.message);
      throw new BadRequestException('Failed to generate payment reference');
    }
  }

  /**
   * Build Paystack payload with enhanced logging and validation
   */
  private buildPaystackPayload(dto: any, cartData: any, reference: string, requestId?: string): any {
    const logId = requestId || 'payload_build';
    
    try {
      this.logger.debug(`[${logId}] Building Paystack payload...`);

      // Validate inputs
      if (!dto || !cartData || !reference) {
        this.logger.error(`[${logId}] Missing required parameters:`, {
          hasDto: !!dto,
          hasCartData: !!cartData,
          hasReference: !!reference
        });
        throw new Error('Missing required parameters for payload building');
      }

      if (!cartData.items || !Array.isArray(cartData.items)) {
        this.logger.error(`[${logId}] Invalid cart items structure:`, {
          hasItems: !!cartData.items,
          isArray: Array.isArray(cartData.items),
          itemsType: typeof cartData.items
        });
        throw new Error('Invalid cart items structure');
      }

      const subtotal = cartData.items.reduce((sum: number, item: any) => {
        if (!item || typeof item.total !== 'number') {
          this.logger.warn(`[${logId}] Invalid cart item found:`, item);
          return sum;
        }
        return sum + item.total;
      }, 0);

      const totalWithShipping = cartData.totalWithShipping;
      
      this.logger.debug(`[${logId}] Cart calculations:`, {
        subtotal,
        totalWithShipping,
        itemCount: cartData.items.length
      });

      if (typeof totalWithShipping !== 'number' || totalWithShipping <= 0) {
        this.logger.error(`[${logId}] Invalid total amount:`, {
          totalWithShipping,
          type: typeof totalWithShipping
        });
        throw new Error('Invalid total amount');
      }

      const shippingFee = totalWithShipping - subtotal;

      // Validate amounts
      if (totalWithShipping < 100) { // Minimum 1 naira in kobo
        this.logger.error(`[${logId}] Transaction amount too low: ${totalWithShipping}`);
        throw new BadRequestException('Transaction amount too low');
      }

      // Validate email
      if (!dto.email || typeof dto.email !== 'string') {
        this.logger.error(`[${logId}] Invalid email address:`, {
          email: dto.email,
          type: typeof dto.email
        });
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
        this.logger.error(`[${logId}] Payload validation failed:`, {
          hasEmail: !!payload.email,
          hasAmount: !!payload.amount,
          hasReference: !!payload.reference
        });
        throw new Error('Payload validation failed - missing required fields');
      }

      this.logger.debug(`[${logId}] Paystack payload built successfully:`, {
        email: `${payload.email.substring(0, 3)}***`,
        amount: payload.amount,
        currency: payload.currency,
        reference: payload.reference
      });

      return payload;

    } catch (error) {
      this.logger.error(`[${logId}] Error building Paystack payload:`, error.message);
      throw new BadRequestException(`Failed to build payment request: ${error.message}`);
    }
  }

  // Keep all other existing methods as they are...
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
        setImmediate(() => this.handleSuccessfulPayment(data).catch(error => 
          this.logger.error('Async webhook processing failed:', error)
        ));
      }
    } catch (error) {
      this.logger.error('Webhook handling error:', error);
    }
  }

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

  async getCartTotal(userId: string): Promise<{ subtotal: number; shipping: number; total: number }> {
    try {
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID for cart total calculation');
      }

      const cartData = await this.getCachedCart(userId, `cart_total_${Date.now()}`);
      
      if (!cartData?.items?.length) {
        return { subtotal: 0, shipping: 750, total: 750 };
      }

      const validItems = cartData.items.filter(item => 
        item && typeof item === 'object' && typeof item.total === 'number'
      );

      if (validItems.length !== cartData.items.length) {
        this.logger.warn(`Cart contains ${cartData.items.length - validItems.length} invalid items for user ${userId}`);
      }

      const subtotal = validItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
      const total = cartData.totalWithShipping || (subtotal + 750);
      const shipping = total - subtotal;

      return { subtotal, shipping, total };
    } catch (error) {
      this.logger.error(`Error getting cart total for user ${userId}:`, error.message);
      return { subtotal: 0, shipping: 750, total: 750 };
    }
  }

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

  private async handleSuccessfulPayment(data: any): Promise<void> {
    try {
      if (!data || !data.reference) {
        this.logger.error('Invalid payment data received:', data);
        return;
      }

      const reference = data.reference;
      
      const verification = await this.callPaystackAPIWithRetry(`/transaction/verify/${reference}`);

      if (verification?.status && verification?.data?.status === 'success') {
        await this.orderService.markOrderAsPaid(reference);
        
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
}