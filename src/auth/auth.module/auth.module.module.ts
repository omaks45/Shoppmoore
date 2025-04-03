/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from '../auth.controller/auth.controller.controller';
import { AuthService } from '../auth.service/auth.service.service';
import { JwtStrategy } from '../jwt.strategy';
import { User, UserSchema } from '../auth.schema';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule, // Load environment variables
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // Load User schema
    PassportModule.register({ defaultStrategy: 'jwt' }), // Enable Passport JWT strategy
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // JWT secret from .env
        signOptions: { expiresIn: '10minutes' }, // Set expiration time
      }),
    }),
    NotificationsModule, // Enable email notifications
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], // Register AuthService and JwtStrategy
  exports: [AuthService, JwtStrategy, PassportModule], // Export for use in other modules
})
export class AuthModuleModule {}
