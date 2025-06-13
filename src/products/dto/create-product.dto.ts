/* eslint-disable prettier/prettier */
/**
 * CreateProductDto
 *
 * This DTO is used for creating a new product.
 * Analytical fields (stockOutCount, salesCount, stockCount) and isAvailable 
 * are handled automatically and not included in the request body.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'The name of the product',
    example: 'Wireless Mouse',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The primary category the product belongs to',
    example: 'Electronics',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'An optional subcategory for further classification',
    required: false,
    example: 'Computer Accessories',
  })
  @IsString()
  @IsOptional()
  subcategory?: string;

  @ApiProperty({
    description: 'The brand name of the product (if any)',
    required: false,
    example: 'Logitech',
  })
  @IsString()
  @IsOptional()
  brandName?: string;

  @ApiProperty({
    description: 'Unit of measurement (e.g., pcs, kg, pack)',
    example: 'pcs',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  
  @ApiProperty({
    description: 'Retail price of the product in numbers (no currency sign)',
    example: 5999,
  })
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  price: number;

  @ApiProperty({
    description: 'Optional product description or specifications',
    required: false,
    example: 'Ergonomic wireless mouse with 2.4GHz connectivity.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Available quantity in stock',
    example: 100,
  })
  @IsNumber()
  @Min(0, { message: 'Available quantity must be a non-negative number' })
  availableQuantity: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Product images',
    required: false,
  })
  imageUrls?: string[];
}