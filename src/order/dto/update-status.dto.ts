/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ example: 'delivered' })
  @IsEnum(['assigned', 'delivered', 'cancelled'], {
    message: 'Status must be one of: assigned, delivered, cancelled',
  })
  status: 'assigned' | 'delivered' | 'cancelled';

  @ApiProperty({ example: 'adminId123' })
  @IsString()
  performedBy: string;
}
