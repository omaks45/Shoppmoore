/* eslint-disable prettier/prettier */
// src/category/dto/update-category.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from '../dto/create-cartegory.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
