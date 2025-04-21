/* eslint-disable prettier/prettier */
import { Type } from 'class-transformer';
import { IsOptional, IsBoolean, IsNumber, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    example: 'Desserts',
    description: 'Updated category name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Cakes, brownies, and other sweets',
    description: 'Updated category description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Set to true to feature category',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: 3,
    description: 'Updated display order for category listing',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  setOrder?: number;

  // Not included in Swagger as this is generated dynamically
  slug?: string;
}
