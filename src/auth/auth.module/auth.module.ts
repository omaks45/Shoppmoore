/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from '../auth.controller/auth.controller.controller';
import { AuthService } from '../auth.service/auth.service.service';
import { JwtStrategy } from '../jwt.strategy';
import { User, UserSchema } from '../auth.schema';
import { JwtAuthGuard } from '../auth.guard';
import { NotificationsModule } from '../../notifications/notifications.module';
import { TokenBlacklistGuard } from '../../common/guards/token-blacklist.guard';

import { UserModule } from '../../users/users.module'; //Fix path & circular import

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    forwardRef(() => UserModule), //Fix circular dependency
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '10m' },
      }),
    }),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, TokenBlacklistGuard],
  exports: [AuthService, JwtStrategy, PassportModule, JwtAuthGuard, TokenBlacklistGuard], //Needed in user module or guards
})
export class AuthModule {}
