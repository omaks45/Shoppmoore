/* eslint-disable prettier/prettier */

/**
 * UpdateCartItemDto
 * Data Transfer Object for updating a cart item.
 * It includes the product ID and quantity.
 * Validation is performed using class-validator decorators.
 */

// src/cart/dto/update-cart-item.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'The ID of the product to update',
    example: '6635b7aeed55b2c0d6b13d19',
  })
  @IsMongoId({ message: 'Invalid productId' })
  productId: string;

  @ApiProperty({
    description: 'New quantity for the product',
    example: 3,
    minimum: 1,
  })
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}
