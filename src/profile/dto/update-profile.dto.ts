/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'New profile image file to replace old one' })
  file: any;
}
