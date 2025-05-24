/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
 // Res,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
//import { PaystackInitResponseDto } from './dto/paystack-init-response.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';
//import { JwtPayload } from 'src/auth/utils/jwt-payload.interface';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';
//import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
//import { Response, Request } from 'express';
//import { PaystackInitResponse } from './interfaces/paystack.interface';
import { Logger } from '@nestjs/common';

@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@ApiTags('Payments')
@Controller('payments')


export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize a Paystack transaction' })
  async initializeTransaction(
    @Body() dto: InitializeTransactionDto,
    @Req() req: any, // request.user should be available from JwtAuthGuard
  ) {
    const { email, _id: userId } = req.user;

    this.logger.log(`User initializing payment: ${email} - ${userId}`);

    return this.paymentService.initializeTransaction({
      ...dto,
      email,
      userId,
    });
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request): Promise<{ message: string }> {
    const isValid = this.paymentService.verifySignature(req);
    if (!isValid) {
      return { message: 'Invalid signature' }; // Nest will handle response
    }

    await this.paymentService.handleWebhook(req.body);
    return { message: 'Webhook processed successfully' };
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verify Paystack Transaction',
    description: 'Verifies the status of a Paystack transaction using its reference.',
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
