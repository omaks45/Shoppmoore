/* eslint-disable prettier/prettier */

import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsInt, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    description: 'The ID of the product to add',
    example: '6635b7aeed55b2c0d6b13d19',
  })
  @IsMongoId({ message: 'Invalid productId' })
  productId: string;

  @ApiProperty({
    description: 'Quantity to add',
    example: 2,
    minimum: 1,
  })
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}
