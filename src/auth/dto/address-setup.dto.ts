/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsOptional } from 'class-validator';

export class AddressSetupDto {
  @IsNotEmpty()
  street: string;

  @IsOptional()
  aptOrSuite?: string;

  @IsNotEmpty()
  city: string;

  @IsNotEmpty()
  country: string;

  @IsNotEmpty()
  zipCode: string;
}
