/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
import { firstValueFrom } from 'rxjs';
import { PaystackInitResponse } from './interfaces/paystack.interface';
import { Inject, forwardRef } from '@nestjs/common';
import { OrderService } from '../order/order.service';
import * as crypto from 'crypto';

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
   * Initializes a Paystack transaction
   */
  async initializeTransaction(dto: InitializeTransactionDto): Promise<PaystackInitResponse> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: dto.email,
          amount: dto.amount * 100, // Convert to kobo
        },
        {
          headers: this.buildHeaders(),
        },
      ),
    );

    return response.data;
  }

  /**
   * Handles webhook and verifies transaction
   */
  async handleWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event === 'charge.success') {
      const reference = data.reference;
      this.logger.log(`Webhook received: charge.success - Ref: ${reference}`);

      const verification = await this.verifyTransaction(reference);

      if (verification.status && verification.data.status === 'success') {
        try {
          await this.orderService.markOrderAsPaid(reference);
          this.logger.log(`Order updated for reference: ${reference}`);
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
}
