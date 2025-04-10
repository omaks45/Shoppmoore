/* eslint-disable prettier/prettier */
/**
 * UpdateProductDto
 * 
 * This Data Transfer Object (DTO) is used for updating an existing product in the system.
 * It extends the CreateProductDto, making all properties optional.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
