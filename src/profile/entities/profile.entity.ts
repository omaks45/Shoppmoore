/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';

export class ProfileEntity {
  @ApiProperty({ example: 'user_id_here', description: 'Reference to the User ID' })
  user: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg', description: 'Cloudinary image URL' })
  profileImageUrl: string;
}
