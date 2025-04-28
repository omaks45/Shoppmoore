/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Profile } from '../profile/profile.schema';
import { User } from '../auth/auth.schema';
import { Model } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Cache } from 'cache-manager';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getProfile(userId: string) {
    const cacheKey = `profile-${userId}`;
    const cachedProfile = await this.cacheManager.get(cacheKey);

    if (cachedProfile) {
      return cachedProfile;
    }

    const profile = await this.profileModel
      .findOne({ user: userId })
      .populate('user', 'firstName lastName email');

    if (!profile) throw new NotFoundException('Profile not found');

    const result = {
      firstName: profile.user['firstName'],
      lastName: profile.user['lastName'],
      email: profile.user['email'],
      profileImageUrl: profile.profileImageUrl,
    };

    // Cache it for 5 minutes (300 seconds)
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const uploadedImage = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);

    const profile = await this.profileModel.findOneAndUpdate(
      { user: userId },
      { profileImageUrl: uploadedImage.secure_url },
      { new: true, upsert: true },
    );

    // Clear cached profile
    await this.cacheManager.del(`profile-${userId}`);

    return profile;
  }

  async updateProfileImage(userId: string, file: Express.Multer.File) {
    const uploadedImage = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);


    const profile = await this.profileModel.findOneAndUpdate(
      { user: userId },
      { profileImageUrl: uploadedImage.secure_url },
      { new: true },
    );

    if (!profile) throw new NotFoundException('Profile not found');

    // Clear cached profile
    await this.cacheManager.del(`profile-${userId}`);

    return profile;
  }

  async deleteProfileImage(userId: string) {
    const profile = await this.profileModel.findOne({ user: userId });
    if (!profile) throw new NotFoundException('Profile not found');

    profile.profileImageUrl = null;
    await profile.save();

    // Clear cached profile
    await this.cacheManager.del(`profile-${userId}`);

    return profile;
  }

  //Admin use case - get paginated list of profiles
  async getAllProfiles(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      this.profileModel
        .find()
        .populate('user', 'firstName lastName email')
        .skip(skip)
        .limit(limit)
        .lean(),
      this.profileModel.countDocuments(),
    ]);

    return {
      data: profiles.map((profile) => ({
        id: profile._id,
        firstName: profile.user['firstName'],
        lastName: profile.user['lastName'],
        email: profile.user['email'],
        profileImageUrl: profile.profileImageUrl,
      })),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
