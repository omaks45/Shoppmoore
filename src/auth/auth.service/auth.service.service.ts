/* eslint-disable prettier/prettier */
import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model } from 'mongoose';
  import { JwtService } from '@nestjs/jwt';
  import { User, UserDocument } from '../auth.schema';
  import { SignupDto } from '../dto/signup.dto';
  import { LoginDto } from '../dto/login.dto';
  import { AddressSetupDto } from '../dto/address-setup.dto';
  import { PasswordUtils } from '../utils/password.util';
  import { JwtPayload } from '../utils/jwt-payload.interface';
  import { ApiTags } from '@nestjs/swagger';
  
  @ApiTags('Authentication')
  @Injectable()
  export class AuthService {
    constructor(
      @InjectModel(User.name) private userModel: Model<UserDocument>,
      private jwtService: JwtService,
    ) {}
  
    async signup(dto: SignupDto): Promise<any> {
      const { firstName, lastName, email, phoneNumber, password, retypePassword } = dto;
  
      if (password !== retypePassword) {
        throw new BadRequestException('Passwords do not match');
      }
      // Check if email already exists
      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
  
      const hashedPassword = await PasswordUtils.hashPassword(password);
      // Create new user
      const newUser = new this.userModel({
        firstName,
        lastName,
        email,
        phoneNumber,
        password: hashedPassword,
        role: 'buyer', // Default role
      });
  
      await newUser.save();
  
      return { message: 'Signup successful. Please verify your email.', newUser };
    }
  
    async login(dto: LoginDto): Promise<any> {
      const { email, password } = dto;
        // Check if user exists
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      // Check if password is valid
      const isPasswordValid = await PasswordUtils.comparePasswords(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
      // Generate JWT token
      const payload: JwtPayload = { 
        userId: user._id as string, 
        email: user.email, 
        role: user.role as 'admin' | 'buyer' 
      };
      const token = this.jwtService.sign(payload);
  
      return { message: 'Login successful', token };
    }
    // Update user address
    async updateAddress(userId: string, dto: AddressSetupDto) {
      return this.userModel.findByIdAndUpdate(userId, { address: dto }, { new: true });
    }
    // Logout user
    async logout() {
      return { message: 'Logged out successfully' };
    }
  }
  