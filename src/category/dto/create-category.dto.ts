/* eslint-disable prettier/prettier */
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Fast Food',
    description: 'Name of the category',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Burgers, fries, nuggets, etc.',
    description: 'Short description of the category',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Mark if this category is featured on the homepage',
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: 'Custom sort order for displaying the category',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  setOrder?: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Image file to upload for the category (JPG, PNG, WebP allowed)',
  })
  @IsOptional()
  image?: any; // multer handles this separately
}
