/* eslint-disable prettier/prettier */
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as rawBody from 'raw-body';
import * as crypto from 'crypto';

@Injectable()
export class PaystackSignatureMiddleware implements NestMiddleware {
  async use(req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) {
    try {
      // Parse raw body for signature verification
      const raw = await rawBody(req);
      req.rawBody = raw;

      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(raw)
        .digest('hex');

      const signature = req.headers['x-paystack-signature'];

      if (hash !== signature) {
        throw new UnauthorizedException('Invalid Paystack Signature');
      }

      next();
    } catch (error) {
        console.warn('Webhook verification error:', error.message);
        throw new UnauthorizedException('Invalid webhook request');
    }
  }
}
