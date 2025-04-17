/* eslint-disable prettier/prettier */

/**
 * @file update-status.dto.ts
 * @description UpdateStatusDto for updating the status of an order
 * @module update-status.dto.ts
 */


import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({ example: 'delivered' })
  status: 'assigned' | 'delivered' | 'cancelled';

  @ApiProperty({ example: 'adminId123' })
  performedBy: string;
}
