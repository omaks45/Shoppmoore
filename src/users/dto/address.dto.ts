/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddressDto {

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  aptOrSuite?: string;


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  country: string;


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  zipCode: string;
}
