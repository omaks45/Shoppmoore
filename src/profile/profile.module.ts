/* eslint-disable prettier/prettier */
import { forwardRef, Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
//import { ProfileController } from './profile.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from './profile.schema';
import { User, UserSchema } from '../auth/auth.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CloudinaryModule,
    forwardRef(() => AuthModule), 
  ],
  //controllers: [ProfileController],
  providers: [ProfileService],
  exports: [MongooseModule], 
})
export class ProfileModule {}
