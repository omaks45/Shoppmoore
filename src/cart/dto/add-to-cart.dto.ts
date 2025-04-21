/* eslint-disable prettier/prettier */

/**
 * AddToCartDto
 * Data Transfer Object for adding a product to the cart.
 * It includes the product ID and quantity.
 * Validation is performed using class-validator decorators.
 */

import { IsMongoId, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID to add to cart' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ description: 'Quantity of the product' })
  @IsNumber()
  @Min(1)
  quantity: number;
}
