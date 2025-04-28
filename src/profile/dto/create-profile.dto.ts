/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

export class CreateProfileImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Profile image file to upload' })
  file: any; // Multer will handle this
}
