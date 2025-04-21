/* eslint-disable prettier/prettier */
/**
 * remove-from-cart.dto.ts
 * Data Transfer Object for removing a product from the cart.
 * It includes the product ID.
 * Validation is performed using class-validator decorators.
 */
import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveFromCartDto {
  @ApiProperty()
  @IsMongoId()
  productId: string;
}
