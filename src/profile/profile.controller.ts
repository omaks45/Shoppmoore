/* eslint-disable prettier/prettier */
// profile/profile.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
//import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TokenBlacklistGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile', description: 'Fetch the authenticated user’s profile with email, name, and profile image.' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully', type: ProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(@Req() req) {
    return this.profileService.getProfile(req.user._id);
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile image', description: 'Upload a new profile image for the authenticated user.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file (JPEG/PNG)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profile image uploaded successfully', type: ProfileResponseDto })
  async uploadProfileImage(@UploadedFile() file: Express.Multer.File, @Req() req) {
    return this.profileService.uploadProfileImage(req.user._id, file);
  }

  @Patch('update-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update profile image', description: 'Replace the current profile image with a new one.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'New profile image file (JPEG/PNG)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profile image updated successfully', type: ProfileResponseDto })
  async updateProfileImage(@UploadedFile() file: Express.Multer.File, @Req() req) {
    return this.profileService.updateProfileImage(req.user._id, file);
  }

  @Delete('delete-image')
  @ApiOperation({ summary: 'Delete profile image', description: 'Remove the user’s profile image and reset it to empty.' })
  @ApiResponse({ status: 200, description: 'Profile image deleted successfully', type: ProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async deleteProfileImage(@Req() req) {
    return this.profileService.deleteProfileImage(req.user._id);
  }
}
