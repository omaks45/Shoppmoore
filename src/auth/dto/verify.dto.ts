/* eslint-disable prettier/prettier */
import { IsNotEmpty } from 'class-validator';

export class VerifyDto {
  @IsNotEmpty()
  verificationCode: string;
}
