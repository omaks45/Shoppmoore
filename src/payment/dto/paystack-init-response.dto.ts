/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

class PaystackInitData {
  @ApiProperty()
  authorization_url: string;

  @ApiProperty()
  access_code: string;

  @ApiProperty()
  reference: string;
}

export class PaystackInitResponseDto {
  @ApiProperty()
  status: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: PaystackInitData })
  data: PaystackInitData;
}
