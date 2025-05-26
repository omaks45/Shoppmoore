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
      // Validate environment configuration
      this.validateEnvironmentConfig();

      // Validate input
      this.validateTransactionInput(dto);

      // Get and validate cart
      const cartData = await this.getValidatedCart(dto.userId);
      
      // Generate payment reference
      const reference = this.generatePaymentReference(dto.userId);
      
      // Prepare payment payload
      const paystackPayload = this.buildPaystackPayload(dto, cartData, reference);
      
      // Log payment details for debugging
      this.logPaymentDetails(cartData, paystackPayload);

      // Initialize transaction with Paystack
      const response = await this.callPaystackAPI('/transaction/initialize', paystackPayload);

      // Validate Paystack response structure
      this.validatePaystackResponse(response);

      this.logger.log(`Transaction initialized successfully. Reference: ${reference}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to initialize transaction for user ${dto.userId}:`, {
        error: error.message,
        stack: error.stack,
        userId: dto.userId,
        email: dto.email
      });
      
      // Re-throw known errors
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Payment initialization failed: ${error.message || 'Unknown error occurred'}`);
    }
  }

  /**
   * Handle Paystack webhooks
   */
  async handleWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    this.logger.log(`Received webhook event: ${event}`);

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
      this.logger.log(`Verifying transaction with reference: ${reference}`);
      
      const verification = await this.verifyTransaction(reference);
      
      if (!verification.status) {
        this.logger.warn(`Transaction verification failed for reference: ${reference}`, {
          verification
        });
      } else {
        this.logger.log(`Transaction verified successfully - Ref: ${reference}, Amount: ₦${verification.data.amount / 100}`);
      }
      
      return verification;
    } catch (error) {
      this.logger.error(`Error verifying transaction ${reference}:`, {
        error: error.message,
        stack: error.stack
      });
      throw new BadRequestException(`Transaction verification failed: ${error.message}`);
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
      if (!this.paystackSecret) {
        this.logger.error('Paystack secret key not configured');
        return false;
      }

      const hash = crypto
        .createHmac('sha512', this.paystackSecret)
        .update(req.rawBody)
        .digest('hex');

      const signature = req.headers['x-paystack-signature'];
      
      if (!signature) {
        this.logger.warn('No Paystack signature found in headers');
        return false;
      }

      const isValid = hash === signature;

      if (!isValid) {
        this.logger.warn('Invalid Paystack webhook signature', {
          expectedHash: hash,
          receivedSignature: signature
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error.message);
      return false;
    }
  }

  /** ================== PRIVATE METHODS ================== */

  /**
   * Validate environment configuration
   */
  private validateEnvironmentConfig(): void {
    if (!this.paystackSecret) {
      throw new BadRequestException('Payment service configuration error: Missing Paystack secret key');
    }

    if (!process.env.PAYMENT_CALLBACK_URL) {
      this.logger.warn('Payment callback URL not configured');
    }
  }

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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }
  }

  /**
   * Validate Paystack API response structure
   */
  private validatePaystackResponse(response: any): void {
    if (!response) {
      throw new BadRequestException('No response received from payment gateway');
    }

    if (!response.status) {
      const errorMessage = response.message || 'Payment gateway returned unsuccessful status';
      this.logger.error('Paystack API error:', {
        status: response.status,
        message: response.message,
        fullResponse: response
      });
      throw new BadRequestException(`Payment initialization failed: ${errorMessage}`);
    }

    if (!response.data) {
      this.logger.error('Invalid Paystack response structure - missing data:', response);
      throw new BadRequestException('Invalid response from payment gateway');
    }

    const requiredFields = ['authorization_url', 'access_code', 'reference'];
    const missingFields = requiredFields.filter(field => !response.data[field]);

    if (missingFields.length > 0) {
      this.logger.error('Missing required fields in Paystack response:', {
        missingFields,
        responseData: response.data
      });
      throw new BadRequestException(`Payment gateway response missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Get and validate user's cart with comprehensive error handling
   */
  private async getValidatedCart(userId: string): Promise<any> {
    this.logger.log(`Getting cart for user: ${userId}`);
    
    // Find cart using multiple strategies
    const cartData = await this.findUserCart(userId);

    if (!cartData) {
      this.logger.warn(`No cart found for user: ${userId}`);
      throw new NotFoundException('No cart found. Please add items to your cart first.');
    }

    if (!cartData.items || cartData.items.length === 0) {
      this.logger.warn(`Empty cart found for user: ${userId}`);
      throw new NotFoundException('Cart is empty. Please add items to your cart before proceeding to payment.');
    }

    // Validate cart items
    this.validateCartItems(cartData.items);

    this.logger.log(`Cart validated successfully for user: ${userId}. Items: ${cartData.items.length}`);
    return cartData;
  }

  /**
   * Find user's cart using multiple query strategies
   */
  private async findUserCart(userId: string): Promise<any> {
    const userIdObj = new Types.ObjectId(userId);
    let cartExists = null;
    let actualUserId = null;

    try {
      // Strategy 1: Query with ObjectId
      cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userIdObj }).lean();
      if (cartExists) {
        actualUserId = cartExists.userId;
        this.logger.log(`Cart found using ObjectId strategy for user: ${userId}`);
      } else {
        // Strategy 2: Query with string userId
        cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userId }).lean();
        if (cartExists) {
          actualUserId = cartExists.userId;
          this.logger.log(`Cart found using string strategy for user: ${userId}`);
        } else {
          // Strategy 3: Query with multiple formats
          cartExists = await this.orderService.cartService.cartModel.findOne({ 
            userId: { $in: [userIdObj, userId, userIdObj.toString()] }
          }).lean();
          if (cartExists) {
            actualUserId = cartExists.userId;
            this.logger.log(`Cart found using multiple formats strategy for user: ${userId}`);
          }
        }
      }

      if (!actualUserId) {
        this.logger.warn(`No cart found with any strategy for user: ${userId}`);
        return null;
      }

      // Get full cart data using the found userId format
      const fullCart = await this.orderService.cartService.getFullCart(actualUserId);
      this.logger.log(`Full cart retrieved for user: ${userId}`, {
        itemCount: fullCart.items?.length || 0,
        total: fullCart.totalWithShipping
      });
      
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
      this.logger.error('Invalid cart items found:', {
        invalidItemsCount: invalidItems.length,
        totalItems: items.length,
        invalidItems: invalidItems.map(item => ({
          productId: item.productId,
          priceSnapshot: item.priceSnapshot,
          total: item.total,
          quantity: item.quantity
        }))
      });
      throw new BadRequestException('Some items in your cart have invalid prices or quantities. Please refresh your cart and try again.');
    }
  }

  /**
   * Generate unique payment reference
   */
  private generatePaymentReference(userId: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const reference = `TXN-${timestamp}-${userId}-${randomSuffix}`;
    
    this.logger.log(`Generated payment reference: ${reference}`);
    return reference;
  }

  /**
   * Build Paystack payment payload
   */
  private buildPaystackPayload(dto: any, cartData: any, reference: string): any {
    const subtotal = cartData.items.reduce((sum: number, item) => sum + Number(item.total), 0);
    const totalWithShipping = cartData.totalWithShipping;
    const shippingFee = totalWithShipping - subtotal;

    // Validate minimum amount (Paystack minimum is ₦1)
    if (totalWithShipping < 1) {
      throw new BadRequestException('Transaction amount must be at least ₦1');
    }

    // Validate maximum amount (adjust based on your business needs)
    if (totalWithShipping > 10000000) { // 10 million naira
      throw new BadRequestException('Transaction amount exceeds maximum limit');
    }

    const payload = {
      email: dto.email.toLowerCase().trim(),
      amount: Math.round(totalWithShipping * 100), // Convert to kobo
      currency: 'NGN',
      reference: reference,
      callback_url: process.env.PAYMENT_CALLBACK_URL || undefined,
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

    this.logger.log(`Built Paystack payload:`, {
      email: payload.email,
      amount: payload.amount,
      reference: payload.reference,
      itemCount: payload.metadata.cartItemsCount
    });

    return payload;
  }

  /**
   * Log payment details for debugging
   */
  private logPaymentDetails(cartData: any, paystackPayload: any): void {
    const subTotal = cartData.items.reduce((sum: number, item) => sum + Number(item.total), 0);
    const shippingFee = cartData.totalWithShipping - subTotal;

    this.logger.log(`=== Payment Breakdown for User ${paystackPayload.metadata.userId} ===`);
    this.logger.log(`Items Count: ${cartData.items.length}`);
    this.logger.log(`Subtotal: ₦${subTotal.toLocaleString()}`);
    this.logger.log(`Shipping: ₦${shippingFee.toLocaleString()}`);
    this.logger.log(`Total: ₦${cartData.totalWithShipping.toLocaleString()}`);
    this.logger.log(`Paystack Amount (kobo): ${paystackPayload.amount.toLocaleString()}`);
    this.logger.log(`Reference: ${paystackPayload.reference}`);
    this.logger.log(`Email: ${paystackPayload.email}`);
    this.logger.log(`===============================================`);
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
        this.logger.warn(`Payment verification failed for reference: ${reference}`, {
          verificationStatus: verification.status,
          dataStatus: verification.data?.status
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process successful payment for reference ${reference}:`, {
        error: error.message,
        stack: error.stack
      });
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
        timeout: 30000, // 30 seconds timeout
      };

      this.logger.log(`Making Paystack API call to: ${endpoint}`, {
        hasPayload: !!payload,
        payloadKeys: payload ? Object.keys(payload) : []
      });

      const response = await firstValueFrom(
        payload 
          ? this.httpService.post(`${this.baseUrl}${endpoint}`, payload, config)
          : this.httpService.get(`${this.baseUrl}${endpoint}`, config)
      );

      this.logger.log(`Paystack API call successful for ${endpoint}`, {
        status: response.status,
        responseStatus: response.data?.status
      });

      return response.data;
    } catch (error) {
      const errorInfo = {
        endpoint,
        error: error.message,
        response: error.response?.data || null,
        status: error.response?.status || null,
        statusText: error.response?.statusText || null
      };

      this.logger.error(`Paystack API call failed for ${endpoint}:`, errorInfo);

      // Provide more specific error messages based on the error type
      if (error.response?.status === 401) {
        throw new BadRequestException('Payment service authentication failed. Please contact support.');
      } else if (error.response?.status === 400) {
        const message = error.response?.data?.message || 'Invalid payment request';
        throw new BadRequestException(`Payment error: ${message}`);
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new BadRequestException('Payment service timeout. Please try again.');
      } else {
        throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
      }
    }
  }

  /**
   * Verify transaction with Paystack
   */
  private async verifyTransaction(reference: string): Promise<any> {
    try {
      this.logger.log(`Verifying transaction with Paystack: ${reference}`);
      
      const response = await this.callPaystackAPI(`/transaction/verify/${reference}`);
      
      if (response.status && response.data) {
        this.logger.log(`Transaction verified successfully:`, {
          reference,
          amount: `₦${response.data.amount / 100}`,
          status: response.data.status,
          gateway_response: response.data.gateway_response
        });
      } else {
        this.logger.warn(`Transaction verification returned false status:`, {
          reference,
          response
        });
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Transaction verification failed for ${reference}:`, {
        error: error.message,
        stack: error.stack
      });
      return { status: false, message: error.message };
    }
  }

  /**
   * Build headers for Paystack API calls
   */
  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.paystackSecret}`,
      'Content-Type': 'application/json',
      'User-Agent': 'YourApp/1.0', // Add user agent for better tracking
    };
  }
}