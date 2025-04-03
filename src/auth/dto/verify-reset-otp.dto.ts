/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyResetOtpDto {
  @ApiProperty({ description: 'Email associated with the OTP', example: 'user@example.com' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ description: 'OTP received via email', example: '123456' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  otp: string;
}
