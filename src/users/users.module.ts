/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../auth/auth.schema';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CacheModule.register(),
    NotificationsModule,
    CloudinaryModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ProfileModule), //Fix circular dependency
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
