/* eslint-disable prettier/prettier */
/**
 * * @file user.controller.ts
 * * @description Controller for managing user-related operations.
 */

import {
  Controller,
  Get,
  Query,
  Param,
  //Post,
  Body,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserService } from '../users/users.service';
//import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UserEntity } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/auth.schema';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()  // Applies to all routes in this controller
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Get all users (Admin only)
  // This endpoint is protected by JWT and Role guards
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, type: [UserEntity] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@Query() filter: FilterUserDto): Promise<UserEntity[]> {
    // service can read filter.page & filter.limit if included there
    return this.userService.findAll(filter);
  }


  // Get a user by ID (Admin and Buyer)
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BUYER)
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, type: UserEntity })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string): Promise<UserEntity> {
    return this.userService.findById(id);
  }

  


  // Update user details (Admin only)
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user details (Admin only)' })
  @ApiResponse({ status: 200, type: UserEntity })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.userService.updateProfile(id, dto);
  }


  // Delete a user (Admin only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
