/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
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
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly cacheTTL: number;
  private readonly cachePrefix: string;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    // Set cache TTL to 5 seconds
    this.cacheTTL = 5;
    
    // Create environment-specific cache prefix
    const env = this.configService.get<string>('NODE_ENV') || 'development';
    this.cachePrefix = `${env}:user`;
  }

  /**
   * Convert MongoDB document to UserEntity
   */
  private toEntity(doc: any): UserEntity {
    const {
      _id,
      firstName,
      lastName,
      email,
      phoneNumber,
      isAdmin,
      isVerified,
      addresses,
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
      addresses,
      createdAt,
    };
  }

  /**
   * Generate a cache key for user profile
   */
  private generateCacheKey(userId: string): string {
    return `${this.cachePrefix}:${userId}:profile`;
  }

  /**
   * Get all keys that match a pattern using Redis SCAN
   */
  private async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      // Access the Redis client directly through the cache manager
      const redisClient = (this.cacheManager as any).store.getClient();
      
      return new Promise((resolve, reject) => {
        const keys: string[] = [];
        const stream = redisClient.scanStream({
          match: pattern,
          count: 100,
        });
        
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });
        
        stream.on('end', () => {
          resolve(keys);
        });
        
        stream.on('error', (err) => {
          this.logger.error(`Error scanning Redis keys with pattern ${pattern}`, err);
          reject(err);
        });
      });
    } catch (error) {
      this.logger.error(`Failed to get keys by pattern: ${pattern}`, error);
      return [];
    }
  }

  /**
   * Invalidate user-related cache entries
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `${this.cachePrefix}:${userId}:*`;
      const keys = await this.getKeysByPattern(pattern);
      
      if (keys.length > 0) {
        const promises = keys.map(key => this.cacheManager.del(key));
        await Promise.all(promises);
        this.logger.debug(`Invalidated ${keys.length} cache keys for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error invalidating cache for user ${userId}:`, error);
      // Continue execution even if cache operations fail
    }
  }

  /**
   * Invalidate and optionally rehydrate user profile cache
   */
  private async invalidateUserProfileCache(userId: string, rehydrate = false) {
    const cacheKey = this.generateCacheKey(userId);
    
    try {
      await this.cacheManager.del(cacheKey);
      this.logger.debug(`Cache invalidated for user ${userId}`);
      
      if (rehydrate) {
        const user = await this.userModel
          .findById(userId)
          .select('firstName lastName email profileImage isVerified addresses');

        if (!user) {
          this.logger.warn(`Failed to rehydrate cache: User ${userId} not found`);
          return;
        }

        const result = {
          id: user.id,
          ...user.toObject(),
        };

        await this.cacheManager.set(cacheKey, result, this.cacheTTL);
        this.logger.debug(`Cache rehydrated for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error invalidating cache for user ${userId}:`, error);
      // Continue execution even if cache operations fail
    }
  }

  /**
   * Get current user profile (with caching)
   */
  async getCurrentUserProfile(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    const cacheKey = this.generateCacheKey(userId);
    
    try {
      // Try to get from cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for user ${userId}`);
        return cached;
      }
      
      this.logger.debug(`Cache miss for user ${userId}, fetching from database`);
    } catch (error) {
      this.logger.warn(`Cache error for user ${userId}:`, error);
      // Continue execution even if cache read fails
    }

    // Get from database if not in cache
    const user = await this.userModel
      .findById(userId)
      .select('firstName lastName email profileImage isVerified addresses');

    if (!user) {
      this.logger.warn(`User not found with ID: ${userId}`);
      throw new NotFoundException('User not found');
    }

    const result = {
      id: user.id,
      ...user.toObject(),
    };

    try {
      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.cacheTTL);
      this.logger.debug(`Profile cached for user ${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to cache profile for user ${userId}:`, error);
      // Continue execution even if cache write fails
    }

    return result;
  }

  /**
   * Upload a new profile image
   */
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

  /**
   * Update existing profile image
   */
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

  /**
   * Delete profile image
   */
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

  /**
   * Find all users with pagination
   */
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

    const cacheKey = `${this.cachePrefix}:all:page:${page}:limit:${limit}`;

    try {
      // Try to get from cache first
      const cached = await this.cacheManager.get<{
        data: UserEntity[];
        metadata: {
          totalItems: number;
          totalPages: number;
          currentPage: number;
          pageSize: number;
        };
      }>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for users list page ${page}`);
        return cached;
      }
      
    } catch (error) {
      this.logger.warn(`Cache error for users list:`, error);
      // Continue execution even if cache read fails
    }

    const totalItems = await this.userModel.countDocuments();
    const docs = await this.userModel.find().skip(skip).limit(limit).lean();
    const totalPages = Math.ceil(totalItems / limit);

    const result = {
      data: docs.map((d) => this.toEntity(d)),
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    };

    try {
      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.cacheTTL);
      this.logger.debug(`Users list page ${page} cached`);
    } catch (error) {
      this.logger.warn(`Failed to cache users list:`, error);
      // Continue execution even if cache write fails
    }

    return result;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserEntity> {
    const cacheKey = `${this.cachePrefix}:${id}:entity`;

    try {
      // Try to get from cache first
      const cached = await this.cacheManager.get<UserEntity>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for user entity ${id}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Cache error for user entity ${id}:`, error);
      // Continue execution even if cache read fails
    }

    const doc = await this.userModel.findById(id).lean();
    if (!doc) throw new NotFoundException('User not found');
    
    const result = this.toEntity(doc);

    try {
      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.cacheTTL);
      this.logger.debug(`User entity ${id} cached`);
    } catch (error) {
      this.logger.warn(`Failed to cache user entity ${id}:`, error);
      // Continue execution even if cache write fails
    }

    return result;
  }

  /**
   * Find raw user document by ID
   */
  async findRawById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const doc = await this.userModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('User not found');

    // Invalidate all user-related caches
    await this.invalidateUserCache(id);

    await this.notificationService.sendNotification({
      message: `Your profile was updated`,
      userId: id,
    });

    return this.toEntity(doc);
  }

  /**
   * Remove user
   */
  async remove(id: string): Promise<void> {
    const doc = await this.userModel.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('User not found');

    // Invalidate all user-related caches
    await this.invalidateUserCache(id);

    await this.notificationService.sendNotification({
      message: `User with ID ${id} has been deleted.`,
      userId: id,
    });
  }
}