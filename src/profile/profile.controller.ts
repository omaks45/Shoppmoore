/* eslint-disable prettier/prettier */

/* 
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
Res } from '@nestjs/common';
import { Response } from 'express';
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
import { ProfileResponseDto } from '../profile/dto/profile-response.dto';
//import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
//import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';
import { JwtAuthGuard } from 'src/auth/auth.guard';


@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  //@UseGuards(AuthGuard('jwt'), TokenBlacklistGuard)
  async getProfile(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const userId = req['user']._id;
    console.log('Serving profile for userId:', userId);
  
    return this.profileService.getProfile(userId);
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
*/