/* eslint-disable prettier/prettier */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for filtering products based on optional query parameters.
 * Both fields are optional and used for narrowing down product search results.
 */
export class FilterProductDto {
  @ApiPropertyOptional({
    description: 'Filter products by category. Example: "electronics", "furniture", "books".',
    example: 'electronics',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter products by brand name. Example: "Apple", "Samsung", "Nike".',
    example: 'Apple',
  })
  @IsOptional()
  @IsString()
  brandName?: string;
}
