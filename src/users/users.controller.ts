/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Query,
  Param,
  Body,
  Put,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UserEntity } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/roles.enum';
import { User } from '../common/decorators/user.decorator'; //New decorator
//import { JwtPayload } from 'src/auth/utils/jwt-payload.interface';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  //Auth-check: Get current authenticated user's raw document
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Authenticated user returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@User() user) {
    console.log('Authenticated user from JWT:', user);
    return user;
  }

  //Check authentication
  @Get('check-auth')
  @UseGuards(JwtAuthGuard)
  checkAuth(@User() user) {
    console.log('Authenticated user:', user);
    return {
      message: 'You are authenticated',
      user,
    };
  }

  //Get all users (Admin only)
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, type: [UserEntity] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query() filter: FilterUserDto,
    @User() user: { userId: string; role: string }
  ): Promise<UserEntity[]> {
    console.log('Admin requesting users list:', user.userId);
    return this.userService.findAll(filter);
  }
  

//Get user by ID (Admin only or self for buyer)
@Get(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BUYER)
@ApiOperation({ summary: 'Get a user by ID' })
@ApiResponse({ status: 200, type: UserEntity })
@ApiResponse({ status: 403, description: 'Forbidden' })
@ApiResponse({ status: 404, description: 'User not found' })
async findOne(
  @Param('id') id: string,
  @User() user: { userId: string; role: string }
): Promise<UserEntity> {
  if (user.role === UserRole.BUYER && user.userId !== id) {
    throw new ForbiddenException('You can only view your own profile');
  }

  return this.userService.findById(id);
}


//Update user details (Admin only)
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
  @User() user: { userId: string }
): Promise<UserEntity> {
  console.log(`Admin ${user.userId} is updating user ${id}`);
  return this.userService.updateProfile(id, dto);
}


@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiOperation({ summary: 'Delete user (Admin only)' })
@ApiResponse({ status: 200, description: 'User deleted successfully' })
@ApiResponse({ status: 403, description: 'Forbidden' })
@ApiResponse({ status: 404, description: 'User not found' })
async remove(
  @Param('id') id: string,
  @User() user: { userId: string }
): Promise<void> {
  console.log(`Admin ${user.userId} is deleting user ${id}`);
  return this.userService.remove(id);
}

}
