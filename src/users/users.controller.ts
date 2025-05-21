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
  Req,
  UploadedFile,
  UseInterceptors,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  getSchemaPath,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UserService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UserEntity } from '../users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AddressDto } from './dto/address.dto';
import { User } from '../common/decorators/user.decorator';

interface AuthUser {
  _id: string;
  email: string;
  role: 'admin' | 'buyer';
}

@ApiTags('Users')
@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ================= User Routes =================

  @Get()
  @ApiOperation({ summary: 'Get all users (Admin dashboard)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
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
  async findAll(@Query() filter: FilterUserDto, @User() user: AuthUser) {
    console.log('Admin requesting users list:', user._id);
    return this.userService.findAll(filter);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getCurrentUserProfile(@User() user: AuthUser) {
    return this.userService.getCurrentUserProfile(user._id);
  }

  @Post('upload/profile-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload user profile image' })
  async uploadImage(@Req() req, @UploadedFile() file: Express.Multer.File) {
    return this.userService.uploadProfileImage(req.user._id, file);
  }

  @Put('update/profile-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Update profile image' })
  async updateImage(@Req() req, @UploadedFile() file: Express.Multer.File) {
    return this.userService.updateProfileImage(req.user._id, file);
  }

  @Delete('delete/profile-image')
  @ApiOperation({ summary: 'Delete profile image' })
  async deleteImage(@Req() req) {
    return this.userService.deleteProfileImage(req.user._id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID (Admin dashboard)' })
  async findOne(@Param('id') id: string): Promise<UserEntity> {
    return this.userService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user details' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @User() user: AuthUser) {
    console.log(`User ${user._id} is updating user ${id}`);
    return this.userService.updateProfile(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Admin dashboard)' })
  async remove(@Param('id') id: string, @User() user: AuthUser): Promise<void> {
    console.log(`Admin ${user._id} is deleting user ${id}`);
    return this.userService.remove(id);
  }

  // ================= Address Routes =================

  @Post('addresses')
  @ApiOperation({ summary: 'Add new address for user' })
  @ApiBody({ type: AddressDto })
  @ApiResponse({ status: 201, description: 'Address added successfully' })
  async addAddress(@User() user: AuthUser, @Body() addressDto: AddressDto) {
    return this.userService.addAddress(user._id, addressDto);
  }

  @Put('addresses/:addressId')
  @ApiOperation({ summary: 'Update an address for user' })
  @ApiBody({ type: AddressDto })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  async updateAddress(
    @User() user: AuthUser,
    @Param('addressId') addressId: string,
    @Body() addressDto: AddressDto,
  ) {
    return this.userService.updateAddress(user._id, addressId, addressDto);
  }

  @Delete('addresses/:addressId')
  @ApiOperation({ summary: 'Delete an address from user profile' })
  @ApiResponse({ status: 200, description: 'Address deleted successfully' })
  async deleteAddress(@User() user: AuthUser, @Param('addressId') addressId: string) {
    return this.userService.deleteAddress(user._id, addressId);
  }
}
