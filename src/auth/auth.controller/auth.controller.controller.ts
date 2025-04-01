/* eslint-disable prettier/prettier */
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  Patch 
} from '@nestjs/common';
import { AuthService } from '../auth.service/auth.service.service';
import { SignupDto } from '../dto/signup.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { LoginDto } from '../dto/login.dto';
import { AddressSetupDto } from '../dto/address-setup.dto';
import { JwtAuthGuard } from '../auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/set-new-password.dto';

@ApiTags('Authentication') // Group authentication-related endpoints in Swagger
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** User Signup (Defaults to "Buyer" role) */
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user (Buyer by default)' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad Request (Invalid data or email already in use)' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /** Super Admin creates an Admin */
  @UseGuards(JwtAuthGuard) // Only authenticated Super Admins can create Admins
  @Post('create-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin creates a new Admin' })
  @ApiResponse({ status: 201, description: 'Admin account successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request (Email already in use)' })
  @ApiResponse({ status: 403, description: 'Forbidden (User not authorized)' })
  async createAdmin(@Request() req, @Body() dto: CreateAdminDto) {
    return this.authService.createAdmin(dto, req.user.id);
  }

  /** User Login */
  @Post('login')
  @ApiOperation({ summary: 'User Login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized (Invalid credentials)' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Update Address (Authenticated Users) */
  @UseGuards(JwtAuthGuard)
  @Patch('address-setup')
  @ApiBearerAuth() // Requires authentication token
  @ApiOperation({ summary: 'Update user address' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized (Token missing or invalid)' })
  async updateAddress(@Request() req, @Body() dto: AddressSetupDto) {
    return this.authService.updateAddress(req.user.id, dto);
  }

  /** Logout User */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout() {
    return this.authService.logout();
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset (Step 1)' })
  @ApiResponse({ status: 200, description: 'OTP sent to registered email' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Patch('reset-password')
  @ApiOperation({ summary: 'Reset password (Step 2)' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP / Passwords do not match' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

}
