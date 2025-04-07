/* eslint-disable prettier/prettier */
/**
 * * @file user.entity.ts
 * * @description User entity for the UserService.
 * * @module user.entity.ts
 * * @requires class-validator
 * * @requires class-transformer
 * * * @requires swagger
 * * @requires auth.schema
 */
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/auth.schema'


export class UserEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty({ required: false })
  address?: {
    street: string;
    aptOrSuite?: string;
    city: string;
    country: string;
    zipCode: string;
  };

  @ApiProperty()
  createdAt: Date;
}
