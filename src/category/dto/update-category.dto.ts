/* eslint-disable prettier/prettier */
/**
 * * @fileoverview This file defines the UpdateCategoryDto class, which is used to update a category.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  slug: string;
}
