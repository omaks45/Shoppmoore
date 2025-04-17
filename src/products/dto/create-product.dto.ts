/* eslint-disable prettier/prettier */
/**
 * CreateProductDto
 *
 * This DTO is used for creating a new product.
 * 'createdBy' is now handled automatically via JWT, not passed in the body.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
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
    description: 'Stock Keeping Unit (unique identifier for the product)',
    example: 'WM-2023-BLK',
  })
  @IsString()
  @IsNotEmpty()
  SKU: string;

  @ApiProperty({
    description: 'Retail price of the product in numbers (no currency sign)',
    example: 5999,
  })
  @IsNumber()
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
    description: 'Product image file (upload as binary)',
    type: 'string',
    format: 'binary',
  })
  image?: any;
}
