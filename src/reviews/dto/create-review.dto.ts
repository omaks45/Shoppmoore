/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 'Product ID (optional for service review)', required: false })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ example: 'The service was excellent!', required: true })
  @IsString()
  content: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'product', enum: ['product', 'service'] })
  @IsEnum(['product', 'service'])
  reviewType: 'product' | 'service';
}
