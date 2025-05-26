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
    });

    // Validate userId first
    if (!dto.userId) {
      this.logger.error('UserId is missing from DTO');
      throw new BadRequestException('User ID is required for payment processing');
    }

    // Validate userId format
    if (!Types.ObjectId.isValid(dto.userId)) {
      this.logger.error(`Invalid userId format: ${dto.userId}`);
      throw new BadRequestException('Invalid user ID format');
    }

    const userIdObj = new Types.ObjectId(dto.userId);
    this.logger.log(`Converting userId to ObjectId: ${dto.userId} -> ${userIdObj}`);

    try {
      // FIXED: Try multiple query strategies to find the cart
      let cartExists = null;
      
      // Strategy 1: Direct ObjectId query
      cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userIdObj }).lean();
      this.logger.log(`Strategy 1 - ObjectId query result:`, {
        cartExists: !!cartExists,
        cartId: cartExists?._id,
        cartUserId: cartExists?.userId,
        rawItemsCount: cartExists?.items?.length || 0
      });

      // Strategy 2: If not found, try with string userId
      if (!cartExists) {
        cartExists = await this.orderService.cartService.cartModel.findOne({ userId: dto.userId }).lean();
        this.logger.log(`Strategy 2 - String query result:`, {
          cartExists: !!cartExists,
          cartId: cartExists?._id,
          cartUserId: cartExists?.userId,
          rawItemsCount: cartExists?.items?.length || 0
        });
      }

      // Strategy 3: If still not found, try finding by string representation of ObjectId
      if (!cartExists) {
        cartExists = await this.orderService.cartService.cartModel.findOne({ 
          userId: { $in: [userIdObj, dto.userId, userIdObj.toString()] }
        }).lean();
        this.logger.log(`Strategy 3 - Multiple formats query result:`, {
          cartExists: !!cartExists,
          cartId: cartExists?._id,
          cartUserId: cartExists?.userId,
          rawItemsCount: cartExists?.items?.length || 0
        });
      }

      // Strategy 4: Debug all carts in database (temporary - remove in production)
      const allCarts = await this.orderService.cartService.cartModel.find({}).lean();
      this.logger.log(`DEBUG - All carts in database:`, allCarts.map(cart => ({
        cartId: cart._id,
        userId: cart.userId,
        userIdType: typeof cart.userId,
        itemsCount: cart.items?.length || 0
      })));

      if (!cartExists) {
        this.logger.error(`No cart found for user ${dto.userId} using any strategy`);
        throw new NotFoundException('No cart found. Please add items to your cart first.');
      }

      if (!cartExists.items || cartExists.items.length === 0) {
        this.logger.error(`Empty cart found for user ${dto.userId}`);
        throw new NotFoundException('Cart is empty. Please add items to your cart before proceeding to payment.');
      }

      // FIXED: Use the actual userId from the found cart instead of the converted one
      const actualUserId = cartExists.userId;
      this.logger.log(`Using actual userId from cart: ${actualUserId} (type: ${typeof actualUserId})`);

      // Get user's FULL cart (not paginated) with populated product data
      // Use the actual userId format that worked
      const cartData = await this.orderService.cartService.getFullCart(actualUserId);

      // Enhanced logging to debug the cart data
      this.logger.log(`Cart data for user ${dto.userId}:`, {
        hasCartData: !!cartData,
        itemsCount: cartData?.items?.length || 0,
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
            total: item.total,
            isProductPopulated: typeof item.productId === 'object'
          });
        });
      } else {
        this.logger.error(`Cart data processing failed for user ${dto.userId}:`, {
          cartDataExists: !!cartData,
          itemsArray: cartData?.items,
          itemsLength: cartData?.items?.length
        });
      }

      if (!cartData || !cartData.items || cartData.items.length === 0) {
        this.logger.warn(`Empty cart detected after processing for user ${dto.userId}`);
        throw new NotFoundException('Cart is empty or could not be processed. Please refresh your cart and try again.');
      }

      // Validate that all cart items have valid prices
      const invalidItems = cartData.items.filter(item => 
        !item.priceSnapshot || 
        item.priceSnapshot <= 0 || 
        !item.total || 
        item.total <= 0 ||
        !item.quantity ||
        item.quantity <= 0
      );

      if (invalidItems.length > 0) {
        this.logger.error(`Invalid cart items found for user ${dto.userId}:`, invalidItems);
        throw new BadRequestException('Some items in your cart have invalid prices or quantities. Please refresh your cart and try again.');
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

      // Generate unique reference
      const reference = `TXN-${Date.now()}-${dto.userId}`;
      
      const paystackPayload = {
        email: dto.email,
        amount: Math.round(totalWithShipping * 100), // convert to kobo and round to avoid decimals
        currency: 'NGN', // Explicitly set currency
        reference: reference,
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
      };

      this.logger.log(`Paystack payload:`, {
        email: paystackPayload.email,
        amount: paystackPayload.amount,
        reference: paystackPayload.reference,
        metadata: paystackPayload.metadata
      });

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transaction/initialize`,
          paystackPayload,
          {
            headers: this.buildHeaders(),
          },
        ),
      );

      this.logger.log(`Transaction initialized successfully. Reference: ${response.data.data?.reference}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to initialize transaction for user ${dto.userId}:`, {
        error: error.message,
        stack: error.stack,
        response: error.response?.data || null
      });
      
      // Re-throw known errors
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      // Handle unknown errors
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

  // FIXED: Helper method to get cart total for external use
  async getCartTotal(userId: string): Promise<{ subtotal: number; shipping: number; total: number }> {
    // Use the same multiple strategy approach as in initializeTransaction
    let actualUserId: any = null;
    const userIdObj = new Types.ObjectId(userId);
    
    // Try to find the cart using different userId formats
    let cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userIdObj }).lean();
    if (cartExists) {
      actualUserId = cartExists.userId;
    } else {
      cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userId }).lean();
      if (cartExists) {
        actualUserId = cartExists.userId;
      } else {
        cartExists = await this.orderService.cartService.cartModel.findOne({ 
          userId: { $in: [userIdObj, userId, userIdObj.toString()] }
        }).lean();
        if (cartExists) {
          actualUserId = cartExists.userId;
        }
      }
    }

    if (!actualUserId) {
      return { subtotal: 0, shipping: 750, total: 750 }; // Return shipping fee even for empty cart
    }

    const cartData = await this.orderService.cartService.getFullCart(actualUserId);
    
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      return { subtotal: 0, shipping: 750, total: 750 }; // Return shipping fee even for empty cart
    }

    const subtotal = cartData.items.reduce((sum, item) => sum + item.total, 0);
    const total = cartData.totalWithShipping;
    const shipping = total - subtotal;

    return { subtotal, shipping, total };
  }

  // Debug method to help troubleshoot cart issues
  async debugUserCart(userId: string) {
    try {
      const userIdObj = new Types.ObjectId(userId);
      
      // Try multiple strategies like in the main method
      let actualUserId: any = null;
      let cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userIdObj }).lean();
      if (cartExists) {
        actualUserId = cartExists.userId;
      } else {
        cartExists = await this.orderService.cartService.cartModel.findOne({ userId: userId }).lean();
        if (cartExists) {
          actualUserId = cartExists.userId;
        } else {
          cartExists = await this.orderService.cartService.cartModel.findOne({ 
            userId: { $in: [userIdObj, userId, userIdObj.toString()] }
          }).lean();
          if (cartExists) {
            actualUserId = cartExists.userId;
          }
        }
      }

      if (!actualUserId) {
        this.logger.error(`No cart found for user ${userId} in debug mode`);
        return { error: 'No cart found' };
      }

      const debugInfo = await this.orderService.cartService.debugCart(actualUserId);
      
      this.logger.log(`Debug info for user ${userId}:`, debugInfo);
      return debugInfo;
    } catch (error) {
      this.logger.error(`Error debugging cart for user ${userId}:`, error);
      throw error;
    }
  }
}