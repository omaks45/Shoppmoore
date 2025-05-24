/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaystackInitResponse } from './interfaces/paystack.interface';
import { Response, Request } from 'express';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';
import { PaystackInitResponseDto } from './dto/paystack-init-response.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from 'src/auth/utils/jwt-payload.interface';

@UseGuards(AuthGuard('jwt'), TokenBlacklistGuard)
@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initialize')
  @ApiOperation({
    summary: 'Initialize Payment',
    description: 'Creates a payment session using Paystack.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initialization successful',
    type: PaystackInitResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async initializeTransaction(
    @Body() dto: InitializeTransactionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaystackInitResponse> {
    return this.paymentService.initializeTransaction({
      ...dto,
      email: user.email,
      userId: user.userId, // Injected from token
    });
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Paystack Webhook Handler',
    description:
      'Handles Paystack payment webhooks. This endpoint should not be public. It verifies the Paystack signature before processing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.paymentService.verifySignature(req)) {
      res.status(401).json({ message: 'Invalid signature' });
    }

    await this.paymentService.handleWebhook(req.body);
    res.status(200).send();
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verify Paystack Transaction',
    description:
      'Verifies the status of a Paystack transaction using its reference.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction verification result',
    schema: {
      example: {
        status: true,
        message: 'Verification successful',
        data: {
          amount: 10000,
          currency: 'NGN',
          transaction_date: '2023-10-01T10:00:00Z',
          status: 'success',
          reference: '7PVGX8MEk85tgeEpVDtD',
          customer: {
            email: 'johndoe@example.com',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found or failed',
  })
  async verifyTransaction(
    @Body() dto: VerifyTransactionDto,
  ): Promise<any> {
    return this.paymentService.verifyTransactionByReference(dto.reference);
  }
}
