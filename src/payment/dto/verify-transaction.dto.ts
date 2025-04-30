/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTransactionDto {
  @ApiProperty({
    description: 'Unique Paystack transaction reference',
    example: '7PVGX8MEk85tgeEpVDtD',
  })
  reference: string;
}
