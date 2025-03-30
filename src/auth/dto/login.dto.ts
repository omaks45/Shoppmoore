/* eslint-disable prettier/prettier */
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'johndoe@gmail.com', description: 'enter your email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SectionsPassword123!', description: 'User password (must contain uppercase, lowercase, number, and special character)' })
  @IsNotEmpty()
  password: string;
}
