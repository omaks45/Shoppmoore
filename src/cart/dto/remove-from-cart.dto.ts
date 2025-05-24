/* eslint-disable prettier/prettier */
/**
 * remove-from-cart.dto.ts
 * Data Transfer Object for removing a product from the cart.
 * It includes the product ID.
 * Validation is performed using class-validator decorators.
 */
// src/cart/dto/remove-from-cart.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class RemoveFromCartDto {
  @ApiProperty({
    description: 'The ID of the product to remove from the cart',
    example: '6635b7aeed55b2c0d6b13d19',
  })
  @IsMongoId({ message: 'Invalid productId' })
  productId: string;
}

