/* eslint-disable prettier/prettier */
/**
 * * @file update-user.dto.ts
 * * @description DTO for updating user information in the UserService. 
 * * * @module update-user.dto.ts
 * * @requires class-validator  
 * * * @requires swagger
 * * @requires class-transformer
 */

import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @IsOptional()
  @ApiProperty()
  @IsString()
  firstName?: string;

  @IsOptional()
  @ApiProperty()
  @IsString()
  lastName?: string;
}
