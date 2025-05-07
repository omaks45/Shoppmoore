/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Profile, ProfileDocument } from '../profile/profile.schema';
import { User, UserDocument } from '../auth/auth.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

// Type for populated profile with user fields
type PopulatedProfile = ProfileDocument & {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
};

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  //Get profile with populated user data
  async getProfile(userId: string) {
    const profile = await this.profileModel
      .findOne({ user: userId })
      .populate('user', 'firstName lastName email') as unknown as PopulatedProfile;
  
    if (!profile || !profile.user) {
      // If no profile or user is missing (shouldn't happen, but safe check)
      return {
        user: {
          firstName: '',
          lastName: '',
          email: '',
        },
        profileImageUrl: '',
        createdAt: null,
        updatedAt: null,
      };
    }
  
    return {
      user: {
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
      },
      profileImageUrl: profile.profileImageUrl ?? '',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
  
  //Upload profile image
  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const uploadedImage = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);

    const profile = await this.profileModel
      .findOneAndUpdate(
        { user: userId },
        { profileImageUrl: uploadedImage.secure_url },
        { new: true, upsert: true },
      )
      .populate('user', 'firstName lastName email') as unknown as PopulatedProfile;

    return {
      user: {
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
      },
      profileImageUrl: profile.profileImageUrl || '',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  //Update profile image
  async updateProfileImage(userId: string, file: Express.Multer.File) {
    const uploadedImage = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);

    const profile = await this.profileModel
      .findOneAndUpdate(
        { user: userId },
        { profileImageUrl: uploadedImage.secure_url },
        { new: true },
      )
      .populate('user', 'firstName lastName email') as unknown as PopulatedProfile;


    return {
      user: {
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
      },
      profileImageUrl: profile.profileImageUrl || '',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  //Delete profile image
  async deleteProfileImage(userId: string) {
    const profile = await this.profileModel
      .findOne({ user: userId })
      .populate('user', 'firstName lastName email') as unknown as PopulatedProfile;


    if (!profile) return null;

    profile.profileImageUrl = '';
    await profile.save();

    return {
      user: {
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
      },
      profileImageUrl: '',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
