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
  //ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  getSchemaPath,
 // ApiResponse,
  //ApiResponse,
} from '@nestjs/swagger';
import { UserService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UserEntity } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/auth.guard';
//import { RolesGuard } from '../common/guards/roles.guard';
//import { Roles } from '../common/decorators/roles.decorator';
//import { UserRole } from 'src/common/enums/roles.enum';
import { User } from '../common/decorators/user.decorator'; //New decorator
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';
//import { JwtPayload } from 'src/auth/utils/jwt-payload.interface';


@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get all users (Admin dashboard)' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Items per page' })
  @ApiOkResponse({
    description: 'List of users with pagination metadata',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(UserEntity) },
        },
        metadata: {
          type: 'object',
          properties: {
            totalItems: { type: 'number', example: 42 },
            totalPages: { type: 'number', example: 5 },
            currentPage: { type: 'number', example: 1 },
            pageSize: { type: 'number', example: 10 },
          },
        },
      },
    },
  })
  async findAll(
    @Query() filter: FilterUserDto,
    @User() user: { userId: string; isAdmin: boolean },
  ): Promise<{
    data: UserEntity[];
    metadata: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  }> {
    console.log('Admin requesting users list:', user.userId);
    return this.userService.findAll(filter);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get a user by ID (Admin dashboard)' })
  async findOne(
    @Param('id') id: string
  ): Promise<UserEntity> {
      return this.userService.findById(id);
  }


  @Put(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Update user details (Admin dashboard)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @User() user: { userId: string }
  ): Promise<UserEntity> {
      console.log(`Admin ${user.userId} is updating user ${id}`);
      return this.userService.updateProfile(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Delete user (Admin dashboard)' })
  async remove(
    @Param('id') id: string,
    @User() user: { userId: string }
  ): Promise<void> {
      console.log(`Admin ${user.userId} is deleting user ${id}`);
      return this.userService.remove(id);
  }
}
