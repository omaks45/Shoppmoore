/* eslint-disable prettier/prettier */
// filter-user.dto.ts
import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterUserDto {
  @IsOptional()
  @Type(() => Number) // Ensures string is casted to number
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Type(() => Boolean)
  isAdmin?: boolean;
}
