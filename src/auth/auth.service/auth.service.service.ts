/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument, UserRole } from '../auth.schema';
import { SignupDto } from '../dto/signup.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { LoginDto } from '../dto/login.dto';
import { AddressSetupDto } from '../dto/address-setup.dto';
import { PasswordUtils } from '../utils/password.util';
import { JwtPayload } from '../utils/jwt-payload.interface';
import { NotificationService } from '../../notifications/notifications.service';
import { ResetPasswordDto } from '../dto/set-new-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Request } from 'express';
import { VerifyDto } from '../dto/verify.dto';
import { ResendOtpDto } from '../dto/resend-otp.dto';
import { VerifyResetOtpDto } from '../dto/verify-reset-otp.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private redisClient: Redis;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  /** 🔹 Initialize Redis Connection */
  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL is not set in environment variables');
    }

    this.redisClient = new Redis(redisUrl);
    console.log('Connected to Redis Cloud ✅');
  }
  /** 🔹 Fetch User by ID */
  async getUserById(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  /** 🔹 User Signup (Default Role: Buyer) */
  async signup(dto: SignupDto): Promise<{ message: string; newUser: UserDocument }> {
    const { firstName, lastName, email, phoneNumber, password, retypePassword } = dto;

    if (password !== retypePassword) throw new BadRequestException('Passwords do not match');

    if (await this.userModel.exists({ email })) throw new BadRequestException('Email already in use');

    const hashedPassword = await PasswordUtils.hashPassword(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 5 * 60 * 1000);

    const newUser = new this.userModel({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      role: 'buyer',
      verificationCode,
      verificationCodeExpires,
    });

    await newUser.save();
    await this.notificationService.sendVerificationEmail(email, verificationCode);

    return { message: 'Signup successful. Please verify your email.', newUser };
  }

  /** 🔹 Create Admin (Restricted Access) */
  async createAdmin(dto: CreateAdminDto): Promise<{ message: string; newAdmin: UserDocument }> {
    const { firstName, lastName, email, phoneNumber, password } = dto;

    if (await this.userModel.exists({ email })) throw new BadRequestException('Email already in use');

    const hashedPassword = await PasswordUtils.hashPassword(password);
    const newAdmin = new this.userModel({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      role: UserRole.ADMIN,
    });

    await newAdmin.save();
    await this.notificationService.sendAdminCreationEmail(email);

    return { message: 'Admin created successfully', newAdmin };
  }

  /** 🔹 Login */
  async login(dto: LoginDto): Promise<{ message: string; token: string }> {
    const { email, password } = dto;
    const user = await this.userModel.findOne({ email });

    if (!user || !(await PasswordUtils.comparePasswords(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role as 'admin' | 'buyer',
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '10m',
    });

    return { message: 'Login successful', token };
  }

  /** 🔹 Update User Address */
  async updateAddress(userId: string, dto: AddressSetupDto) {
    return this.userModel.findByIdAndUpdate(userId, { address: dto }, { new: true });
  }

  /** 🔹 Logout User (Invalidate JWT) */
  async logout(req: Request): Promise<{ message: string }> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) throw new UnauthorizedException('No token provided');

      const token = authHeader.split(' ')[1];
      if (!token) throw new UnauthorizedException('Invalid token');

      // Decode token to get expiration time
      const decodedToken = this.jwtService.decode(token) as any;
      if (!decodedToken?.exp) throw new UnauthorizedException('Invalid token payload');

      const expiresIn = decodedToken.exp - Math.floor(Date.now() / 1000);
      if (expiresIn <= 0) throw new UnauthorizedException('Token already expired');

      // Blacklist token in Redis
      await this.redisClient.setex(`blacklist:${token}`, expiresIn, 'blacklisted');

      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new UnauthorizedException('Logout failed');
    }
  }

  /** 🔹 Check if Token is Blacklisted */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return (await this.redisClient.get(`blacklist:${token}`)) === 'blacklisted';
  }

  /** 🔹 Request Password Reset */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = dto;
    const user = await this.userModel.findOne({ email });

    if (!user) throw new NotFoundException('User not found');

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
    await user.save();

    await this.notificationService.sendPasswordResetEmail(email, resetToken);

    return { message: 'Password reset OTP sent to email' };
  }

  /** Reset Password (After OTP Verification) */
async resetPassword(email: string, dto: ResetPasswordDto): Promise<{ message: string }> {
  const { newPassword, confirmPassword } = dto;

  // Find user by email
  const user = await this.userModel.findOne({ email });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // Ensure passwords match
  if (newPassword !== confirmPassword) {
    throw new BadRequestException('Passwords do not match');
  }

  // Hash and save new password
  user.password = await PasswordUtils.hashPassword(newPassword);
  user.passwordResetToken = null; // Clear reset token
  user.passwordResetExpires = null; // Clear expiration
  await user.save();

  return { message: 'Password reset successful' };
}

 
//** 🔹 Verify Password Reset OTP */
  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<{ message: string; email: string }> {
    const { email, otp } = dto;
    const user = await this.userModel.findOne({ email });
  
    if (!user || user.passwordResetToken !== otp || new Date() > user.passwordResetExpires) {
      throw new BadRequestException('Invalid or expired OTP');
    }
  
    // OTP is valid, clear it from the database
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
  
    return { message: 'OTP is valid. Proceed to reset password', email };
  }
  


  /** 🔹 Verify User Email */
  async verifyEmail(dto: VerifyDto): Promise<{ message: string }> {
    const { email, verificationCode } = dto;
    const user = await this.userModel.findOne({ email });
  
    if (!user) throw new NotFoundException('User not found');
  
    if (!user.verificationCode || user.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid OTP');
    }
  
    if (new Date() > user.verificationCodeExpires) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }
  
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();
  
    return { message: 'Email verified successfully' };
  }
  
  /** 🔹 Resend OTP */
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const { email } = dto;
    const user = await this.userModel.findOne({ email });
  
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }
  
    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = newOtp;
    user.verificationCodeExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
    await user.save();
  
    // Send email notification
    await this.notificationService.sendVerificationEmail(email, newOtp);
  
    return { message: 'New OTP sent to your email' };
  }
  
}
