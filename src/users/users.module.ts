/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/auth.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CacheModule.register(),
    NotificationsModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
