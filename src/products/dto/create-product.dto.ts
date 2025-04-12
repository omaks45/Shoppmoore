/* eslint-disable prettier/prettier */
/**
 * CreateProductDto
 * 
 * This Data Transfer Object (DTO) is used for creating a new product in the system.
 * It defines the structure of the data that should be sent in the request body when creating a product.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsMongoId,
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

  @ApiProperty({
    description: 'MongoDB ObjectId of the user creating the product',
    example: '60f8a1c8e1c4e012d4c0a5f9',
  })
  @IsMongoId()
  createdBy: string;
}
