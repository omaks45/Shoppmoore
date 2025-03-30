/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class AddressSetupDto {
  @ApiProperty({ example: '123 Main St', description: 'Street address' })
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'Apt 4B', description: 'Apartment or suite number' })
  @IsOptional()
  aptOrSuite?: string;

  @ApiProperty({ example: 'New York', description: 'City name' })
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'USA', description: 'Country name' })
  @IsNotEmpty()
  country: string;

  @ApiProperty({ example: '10001', description: 'ZIP or postal code' })
  @IsNotEmpty()
  zipCode: string;
}
