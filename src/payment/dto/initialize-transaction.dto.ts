/* eslint-disable prettier/prettier */

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class InitializeTransactionDto {
  @ApiProperty({
    description: 'Amount to be paid in Naira (₦)',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
