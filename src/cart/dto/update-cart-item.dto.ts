/* eslint-disable prettier/prettier */

/**
 * UpdateCartItemDto
 * Data Transfer Object for updating a cart item.
 * It includes the product ID and quantity.
 * Validation is performed using class-validator decorators.
 */

import { IsMongoId, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty()
  @IsMongoId()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;
}
