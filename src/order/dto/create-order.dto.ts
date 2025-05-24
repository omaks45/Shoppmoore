/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNumber, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty({ example: '660b...', description: 'Product ID (MongoDB ObjectId)' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity of the product' })
  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: '660a...', description: 'Buyer ID (MongoDB ObjectId)' })
  @IsMongoId()
  buyer: string;

  @ApiProperty({
    example: [{ productId: '660b...', quantity: 2 }],
    description: 'List of order items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];

  @ApiProperty({ example: 'debit card', description: 'Payment method' })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ example: 23000, description: 'Total price of the order' })
  @IsNumber()
  totalPrice: number;
}
