/* eslint-disable prettier/prettier */
/**
 * CreateCategoryDto
 * @description Data Transfer Object for creating a new category
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Groceries' })
  @IsString()
  @MinLength(2)
  name: string;
}
