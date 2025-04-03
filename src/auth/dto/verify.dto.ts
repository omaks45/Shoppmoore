/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class VerifyDto {
  @ApiProperty({ example: "user's@example.com", description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "458901", description: 'Otp sent to your email address' })
  @IsNotEmpty()
  verificationCode: string;
}
