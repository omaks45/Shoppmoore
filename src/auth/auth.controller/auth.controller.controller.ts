/* eslint-disable prettier/prettier */
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  Patch, 
  Req, 
  //ForbiddenException,
  Get
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from '../auth.service/auth.service.service';
import { SignupDto } from '../dto/signup.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { LoginDto } from '../dto/login.dto';
import { AddressSetupDto } from '../dto/address-setup.dto';
import { JwtAuthGuard } from '../auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/set-new-password.dto';
//import { UserRole } from '../auth.schema';
//import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@ApiTags('Authentication') // Group authentication-related endpoints in Swagger
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 🔹 User Signup (Defaults to "Buyer" role) */
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user (Buyer by default)' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad Request (Invalid data or email already in use)' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @UseGuards(ApiKeyGuard) // Require API key for this route
  @Post('create-admin')
  @ApiOperation({ summary: 'Create an Admin (Restricted by API Key)' })
  @ApiResponse({ status: 201, description: 'Admin successfully created' })
  @ApiResponse({ status: 403, description: 'Forbidden: Invalid API Key' })
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.authService.createAdmin(dto);
  }

  /** 🔹 User Login */
  @Post('login')
  @ApiOperation({ summary: 'User Login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized (Invalid credentials)' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Get User Profile (Requires Authentication) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized (Invalid or missing token)' })
  async getProfile(@Request() req) {
    return req.user; // Returns JWT payload (user details)
  }

  /** 🔹 Update Address (Authenticated Users) */
  @UseGuards(JwtAuthGuard)
  @Patch('address-setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user address' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized (Token missing or invalid)' })
  async updateAddress(@Request() req, @Body() dto: AddressSetupDto) {
    return this.authService.updateAddress(req.user.id, dto);
  }

  /** 🔹 Logout User (Invalidate JWT) */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: ExpressRequest) {
    return this.authService.logout(req);
  }
  /** 🔹 Forgot Password (Request OTP) */
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset (Step 1)' })
  @ApiResponse({ status: 200, description: 'OTP sent to registered email' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** 🔹 Reset Password (Using OTP) */
  @Patch('reset-password')
  @ApiOperation({ summary: 'Reset password (Step 2)' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP / Passwords do not match' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
