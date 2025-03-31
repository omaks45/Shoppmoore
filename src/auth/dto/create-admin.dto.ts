/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Admin first name',
    example: 'John',
  })
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiProperty({
    description: 'Admin last name',
    example: 'Doe',
  })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @ApiProperty({
    description: 'Admin email address (must be unique)',
    example: 'admin@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'Admin phone number (must be unique)',
    example: '+1234567890',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\+\d{7,15}$/, {
    message: 'Phone number must be in international format, e.g., +1234567890',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Password (minimum 6 characters)',
    example: 'SecurePass123',
  })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
