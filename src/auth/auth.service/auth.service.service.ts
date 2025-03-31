/* eslint-disable prettier/prettier */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../auth.schema';
import { SignupDto } from '../dto/signup.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { LoginDto } from '../dto/login.dto';
import { AddressSetupDto } from '../dto/address-setup.dto';
import { PasswordUtils } from '../utils/password.util';
import { JwtPayload } from '../utils/jwt-payload.interface';
import { NotificationService } from '../../notifications/notifications.service';
import { ApiTags } from '@nestjs/swagger';
import { ResetPasswordDto } from '../dto/set-new-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';

@ApiTags('Authentication')
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private notificationService: NotificationService, // Inject NotificationService
  ) {}

  /** Normal user signup (Default: Buyer) */
  async signup(dto: SignupDto): Promise<any> {
    const { firstName, lastName, email, phoneNumber, password, retypePassword } = dto;

    if (password !== retypePassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await PasswordUtils.hashPassword(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

    const newUser = new this.userModel({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      role: 'buyer', // Default role
      verificationCode,
    });

    await newUser.save();
    await this.notificationService.sendVerificationEmail(email, verificationCode);

    return { message: 'Signup successful. Please verify your email.', newUser };
  }

  /** Super Admin creates an Admin */
  async createAdmin(dto: CreateAdminDto, superAdminId: string): Promise<any> {
    const superAdmin = await this.userModel.findById(superAdminId);
    if (!superAdmin || superAdmin.role !== 'super-admin') {
      throw new ForbiddenException('Only Super Admins can create Admins');
    }

    const { firstName, lastName, email, phoneNumber, password } = dto;

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await PasswordUtils.hashPassword(password);

    const newAdmin = new this.userModel({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      role: 'admin',
      createdBy: superAdminId,
    });

    await newAdmin.save();
    await this.notificationService.sendAdminCreationEmail(email);

    return { message: 'Admin created successfully', newAdmin };
  }

  /** Login */
  async login(dto: LoginDto): Promise<any> {
    const { email, password } = dto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await PasswordUtils.comparePasswords(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { 
      userId: user._id as string, 
      email: user.email, 
      role: user.role as 'admin' | 'buyer' 
    };
    const token = this.jwtService.sign(payload);

    return { message: 'Login successful', token };
  }

  /** Update user address */
  async updateAddress(userId: string, dto: AddressSetupDto) {
    return this.userModel.findByIdAndUpdate(userId, { address: dto }, { new: true });
  }

  /** Logout user */
  async logout() {
    return { message: 'Logged out successfully' };
  }

  /** Request password reset (Step 1) */
  async forgotPassword(dto: ForgotPasswordDto): Promise<any> {
    const { email } = dto;
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setMinutes(resetTokenExpiry.getMinutes() + 5); // OTP expires in 5 minutes

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    await this.notificationService.sendPasswordResetEmail(email, resetToken);

    return { message: 'Password reset OTP sent to email' };
  }

  /** Reset password (Step 2) */
  async resetPassword(dto: ResetPasswordDto): Promise<any> {
    const { email, otp, newPassword, confirmPassword } = dto;
    const user = await this.userModel.findOne({ email });

    if (!user || user.passwordResetToken !== otp || new Date() > user.passwordResetExpires) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    user.password = await PasswordUtils.hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return { message: 'Password reset successful' };
  }
}
