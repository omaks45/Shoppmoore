/* eslint-disable prettier/prettier */

/**
 * @file create-order.dto.ts
 * @description CreateOrderDto for creating a new order
 * @module create-order.dto.ts
 * @requires @nestjs/swagger
 * @requires class-validator
 * @requires class-transformer
 */

import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: '660a...', description: 'Buyer ID' })
  buyer: string;

  @ApiProperty({
    example: [{ productId: '660b...', quantity: 2 }],
  })
  orderItems: { productId: string; quantity: number }[];

  @ApiProperty()
  paymentMethod: string;

  @ApiProperty()
  totalPrice: number;
}
