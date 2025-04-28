/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { UseGuards } from '@nestjs/common';
import { Express } from 'express';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';
import { 
  ApiTags, 
  ApiConsumes, 
  ApiBody, 
  ApiQuery, 
  ApiParam, 
  ApiResponse 
} from '@nestjs/swagger';

@ApiTags('Profiles')
@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Get a user's profile
  @Get(':userId')
  @ApiParam({ name: 'userId', required: true, description: 'ID of the user whose profile to fetch' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved user profile.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async getProfile(@Param('userId') userId: string) {
    return this.profileService.getProfile(userId);
  }

  // Upload a new profile image
  @Post(':userId/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'userId', required: true, description: 'ID of the user to upload profile image for' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Profile image uploaded successfully.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async uploadProfileImage(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.uploadProfileImage(userId, file);
  }

  // Update (overwrite) profile image
  @Put(':userId/update-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'userId', required: true, description: 'ID of the user to update profile image for' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profile image updated successfully.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async updateProfileImage(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.updateProfileImage(userId, file);
  }

  // Delete profile image
  @Delete(':userId/delete-image')
  @ApiParam({ name: 'userId', required: true, description: 'ID of the user to delete profile image from' })
  @ApiResponse({ status: 200, description: 'Profile image deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async deleteProfileImage(@Param('userId') userId: string) {
    return this.profileService.deleteProfileImage(userId);
  }

  // Admin - Get all profiles (paginated)
  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of profiles per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved paginated list of profiles.' })
  async getAllProfiles(
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
  ) {
    return this.profileService.getAllProfiles(page, limit);
  }
}
