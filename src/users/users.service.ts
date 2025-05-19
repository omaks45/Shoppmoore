/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/auth.schema';
import { NotificationService } from '../notifications/notifications.service';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private toEntity(doc: any): UserEntity {
    const {
      _id,
      firstName,
      lastName,
      email,
      phoneNumber,
      isAdmin,
      isVerified,
      address,
      createdAt,
    } = doc;

    return {
      id: _id.toString(),
      firstName,
      lastName,
      email,
      phoneNumber,
      isAdmin,
      isVerified,
      address,
      createdAt,
    };
  }

  private async invalidateUserProfileCache(userId: string, rehydrate = false) {
    const cacheKey = `user-profile-${userId}`;
    await this.cacheManager.del(cacheKey);

    if (rehydrate) {
      const user = await this.userModel
        .findById(userId)
        .select('firstName lastName email profileImage isVerified');

      if (!user) throw new NotFoundException('User not found');

      const result = {
        id: user.id,
        ...user.toObject(),
      };

      await this.cacheManager.set(cacheKey, result, 60 * 2);
    }
  }

  async getCurrentUserProfile(userId: string) {
    const cacheKey = `user-profile-${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const user = await this.userModel
      .findById(userId)
      .select('firstName lastName email profileImage isVerified');

    if (!user) throw new NotFoundException('User not found');

    const result = {
      id: user.id,
      ...user.toObject(),
    };

    await this.cacheManager.set(cacheKey, result, 60 * 2);
    return result;
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!file) throw new BadRequestException('Image file is required');

    const result = await this.cloudinaryService.uploadImage(file.buffer, `profile_${userId}`);

    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();

    await this.invalidateUserProfileCache(userId);

    return { profileImage: user.profileImage };
  }

  async updateProfileImage(userId: string, file: Express.Multer.File) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!file) throw new BadRequestException('Image file is required');

    if (user.profileImagePublicId) {
      await this.cloudinaryService.deleteImage(user.profileImagePublicId);
    }

    const result = await this.cloudinaryService.uploadImage(file.buffer, `profile_${userId}`);
    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();

    await this.invalidateUserProfileCache(userId);

    return { profileImage: user.profileImage };
  }

  async deleteProfileImage(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.profileImagePublicId) {
      await this.cloudinaryService.deleteImage(user.profileImagePublicId);
    }

    user.profileImage = undefined;
    user.profileImagePublicId = undefined;
    await user.save();

    await this.invalidateUserProfileCache(userId);

    return { message: 'Profile image deleted successfully' };
  }

  async findAll(filter: FilterUserDto): Promise<{
    data: UserEntity[];
    metadata: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  }> {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 10;
    const skip = (page - 1) * limit;

    const totalItems = await this.userModel.countDocuments();
    const docs = await this.userModel.find().skip(skip).limit(limit).lean();

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: docs.map((d) => this.toEntity(d)),
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  async findById(id: string): Promise<UserEntity> {
    const doc = await this.userModel.findById(id).lean();
    if (!doc) throw new NotFoundException('User not found');
    return this.toEntity(doc);
  }

  async findRawById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const doc = await this.userModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('User not found');

    await this.invalidateUserProfileCache(id);

    await this.notificationService.sendNotification({
      message: `Your profile was updated`,
      userId: id,
    });

    return this.toEntity(doc);
  }

  async remove(id: string): Promise<void> {
    const doc = await this.userModel.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('User not found');

    await this.invalidateUserProfileCache(id);

    await this.notificationService.sendNotification({
      message: `User with ID ${id} has been deleted.`,
      userId: id,
    });
  }
}
