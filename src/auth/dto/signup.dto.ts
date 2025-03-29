/* eslint-disable prettier/prettier */
import { IsEmail, IsNotEmpty, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'John', description: 'First name of the user' })
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name of the user' })
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '1234567890', description: 'User phone number' })
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, { message: 'Phone number must contain only numbers' })
  phoneNumber: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'User password (must contain uppercase, lowercase, number, and special character)' })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Retype the password for confirmation' })
  @IsNotEmpty()
  retypePassword: string;
}
