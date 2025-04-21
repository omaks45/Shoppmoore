/* eslint-disable prettier/prettier */
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  Patch, 
  Req, 
  Get, 
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request as ExpressRequest } from 'express';
import { AuthService } from '../auth.service/auth.service.service';
import { SignupDto } from '../dto/signup.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { LoginDto } from '../dto/login.dto';
import { AddressSetupDto } from '../dto/address-setup.dto';
import { JwtAuthGuard } from '../auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/set-new-password.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { VerifyDto } from '../dto/verify.dto';
import { ResendOtpDto } from '../dto/resend-otp.dto';
import { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';
import { User, UserDocument } from '../auth.schema';

@ApiTags('Authentication') 
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>, // ✅ Inject UserModel
  ) {}

  /** 🔹 User Signup (Defaults to "Buyer" role) */
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user (Buyer by default)' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @UseGuards(ApiKeyGuard) 
  @Post('create-admin')
  @ApiOperation({ summary: 'Create an Admin (Restricted by API Key)' })
  @ApiResponse({ status: 201, description: 'Admin successfully created' })
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.authService.createAdmin(dto);
  }

  /** 🔹 User Login */
  @Post('login')
  @ApiOperation({ summary: 'User Login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Get User Profile (Requires Authentication) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@Request() req) {
    return req.user; 
  }

  /** 🔹 Update Address (Authenticated Users) */
  @Patch('address-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateAddress(@Request() req, @Body() dto: AddressSetupDto) {
    //console.log('req.user:', req.user);
    const userId = req.user._id || req.user.id;
    return this.authService.updateAddress(userId, dto);
    
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
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** 🔹 Reset Password (Step 2, after OTP verification) */
@Patch('reset-password')
@ApiOperation({ summary: 'Reset password (Step 2, after OTP verification)' })
@ApiResponse({ status: 200, description: 'Password reset successful' })
@ApiResponse({ status: 400, description: 'Passwords do not match / User not found' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      newPassword: { type: 'string', example: 'Password@123' },
      confirmPassword: { type: 'string', example: 'Password@123' },
    },
  },
})
async resetPassword(
  @Body() dto: ResetPasswordDto,
  @Query('email') email: string, // Get email from query params
) {
  return this.authService.resetPassword(email, dto);
}

  /** 🔹 Verify Password Reset OTP */
  @Post('verify-reset-otp')
  @ApiOperation({ summary: 'Verify OTP for password reset' })
  @ApiResponse({ status: 200, description: 'OTP is valid' })
  async verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  /** 🔹 Verify Email (Using OTP) */
  @Patch('verify-otp')
  @ApiOperation({ summary: 'Verify email using OTP' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Body() dto: VerifyDto) {
    return this.authService.verifyEmail(dto);
  }

  /** 🔹 Resend OTP (For Email Verification) */
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiResponse({ status: 200, description: 'New OTP sent' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }
}
