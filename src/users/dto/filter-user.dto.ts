/* eslint-disable prettier/prettier */
/*
    * @file filter-user.dto.ts
    * @description DTO for filtering users in the UserService.
    * @module filter-user.dto.ts
    * @requires class-validator
    * @requires class-transformer
    * @requires swagger
*/

import { IsOptional, IsIn, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterUserDto {
  @ApiPropertyOptional({ enum: ['admin', 'buyer'] })
  @IsOptional()
  @IsIn(['admin', 'buyer'])
  role?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumberString()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumberString()
  limit?: number;
}
