/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty()
  street: string;

  @ApiProperty({ required: false })
  aptOrSuite?: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  zipCode: string;
}
