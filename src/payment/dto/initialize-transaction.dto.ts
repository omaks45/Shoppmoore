/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty} from 'class-validator';

export class InitializeTransactionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
