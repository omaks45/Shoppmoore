/* eslint-disable prettier/prettier */
import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Updated image for the category (JPG, PNG, WebP allowed)',
  })
  @IsOptional()
  image?: any; // multer handles file upload

  @ApiHideProperty()
  slug?: string; // Dynamically generated, hidden from Swagger
}
