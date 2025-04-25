/* eslint-disable prettier/prettier */
/**
 * * @file user.entity.ts
 * * @description User entity for the UserService.
 */
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    example: false,
    description: 'Set to true for Admin, false for Buyer',
  })
  isAdmin: boolean;

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
