/* eslint-disable prettier/prettier */
import { ApiProperty } from "@nestjs/swagger";
import { AddressDto } from "../dto/address.dto";
export class UserEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({
    example: false,
    description: 'Set to true for Admin, false for Buyer',
  })
  isAdmin: boolean;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty({ type: [AddressDto] })
  addresses: AddressDto[];
  

  @ApiProperty({ required: false })
  profileImage?: string;

  @ApiProperty()
  createdAt: Date;

}
