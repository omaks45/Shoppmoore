/* eslint-disable prettier/prettier */
// src/category/category.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Category, CategoryDocument } from './schema/category.schema';
import { Model } from 'mongoose';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../auth/utils/slugify';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { randomUUID } from 'crypto';
import { isValidObjectId } from 'mongoose';
import { CacheService, CacheKeyGenerator, CacheTag, CACHE_CONFIG } from '../types/cache.service';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private readonly cloudinary: CloudinaryService,
    private readonly cacheService: CacheService,
  ) {}

  private validateImage(file: Express.Multer.File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, or WEBP files are allowed');
    }

    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 2MB');
    }
  }

  private extractPublicId(url: string): string | null {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.(?:jpg|jpeg|png|webp)/);
    return match ? match[1] : null;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = slugify(dto.name);

    let imageUrl: string | undefined;

    if (dto.image) {
      this.validateImage(dto.image);

      const filename = `category-${slug}-${randomUUID()}`;
      const uploadedImage = await this.cloudinary.uploadImage(dto.image.buffer, filename);

      // Extract only the secure_url to save in DB
      imageUrl = uploadedImage.secure_url;
    }

    const newCategory = new this.categoryModel({
      ...dto,
      slug,
      image: imageUrl, // Store only the string URL
    });

    const saved = await newCategory.save();
    
    // Invalidate all category-related caches
    await this.invalidateCategoryCaches();
    
    // Cache the newly created category
    await this.cacheService.set(
      CacheKeyGenerator.category(saved._id.toString()),
      saved,
      CACHE_CONFIG.TTL.LONG,
      'category'
    );
    
    // Cache by slug as well
    await this.cacheService.set(
      CacheKeyGenerator.category(saved.slug),
      saved,
      CACHE_CONFIG.TTL.LONG,
      'category'
    );

    this.logger.debug(`Created category: ${saved.name} (ID: ${saved._id})`);
    return saved;
  }

  async findAll(page = 1, limit = 10) {
    const cacheKey = CacheKeyGenerator.categoryList(page, limit);
    
    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey, 'category');
    if (cached) {
      this.logger.debug(`Cache hit for category list: page ${page}, limit ${limit}`);
      return cached;
    }

    const skip = (page - 1) * limit;
    const [categories, total] = await Promise.all([
      this.categoryModel.find().sort({ sortOrder: 1 }).skip(skip).limit(limit),
      this.categoryModel.countDocuments(),
    ]);

    const lastPage = Math.ceil(total / limit);

    const result = {
      data: categories,
      meta: {
        total,
        page,
        limit,
        lastPage,
        hasNextPage: page < lastPage,
        hasPrevPage: page > 1,
      },
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_CONFIG.TTL.MEDIUM, 'category');
    
    // Also cache individual categories for faster access
    await this.cacheIndividualCategories(categories);

    this.logger.debug(`Loaded category list: page ${page}, limit ${limit}, total ${total}`);
    return result;
  }

  async findByIdOrSlug(identifier: string): Promise<Category> {
    const cacheKey = CacheKeyGenerator.category(identifier);
    
    // Try cache first
    const cached = await this.cacheService.get<Category>(cacheKey, 'category');
    if (cached) {
      this.logger.debug(`Cache hit for category: ${identifier}`);
      return cached;
    }

    let category: Category | null = null;
  
    if (isValidObjectId(identifier)) {
      category = await this.categoryModel.findById(identifier);
    } 
  
    if (!category) {
      category = await this.categoryModel.findOne({ slug: identifier });
    }
  
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Cache the found category with multiple keys for faster access
    await Promise.all([
      this.cacheService.set(
        CacheKeyGenerator.category(category._id.toString()),
        category,
        CACHE_CONFIG.TTL.LONG,
        'category'
      ),
      this.cacheService.set(
        CacheKeyGenerator.category(category.slug),
        category,
        CACHE_CONFIG.TTL.LONG,
        'category'
      ),
    ]);

    this.logger.debug(`Loaded category from DB: ${identifier}`);
    return category;
  }
   
  async searchByName(keyword: string, page = 1, limit = 10) {
    const cacheKey = CacheKeyGenerator.categorySearch(keyword, page, limit);
    
    // Try cache first
    const cached = await this.cacheService.get(cacheKey, 'category');
    if (cached) {
      this.logger.debug(`Cache hit for category search: ${keyword}`);
      return cached;
    }

    const skip = (page - 1) * limit;
    const regex = new RegExp(keyword, 'i');

    const [results, total] = await Promise.all([
      this.categoryModel.find({ name: { $regex: regex } }).skip(skip).limit(limit),
      this.categoryModel.countDocuments({ name: { $regex: regex } }),
    ]);

    const lastPage = Math.ceil(total / limit);

    const result = {
      data: results,
      meta: {
        total,
        page,
        limit,
        lastPage,
        hasNextPage: page < lastPage,
        hasPrevPage: page > 1,
      },
    };

    // Cache the search result
    await this.cacheService.set(cacheKey, result, CACHE_CONFIG.TTL.SHORT, 'category');
    
    // Cache individual categories from search results
    await this.cacheIndividualCategories(results);

    this.logger.debug(`Category search completed: ${keyword}, found ${total} results`);
    return result;
  }

  async update(id: string, dto: UpdateCategoryDto, file?: Express.Multer.File) {
    const existing = await this.categoryModel.findById(id);
    if (!existing) throw new NotFoundException('Category not found');
  
    let imageUrl;
  
    if (file) {
      this.validateImage(file);
  
      // Delete old image if it exists
      if (existing.image) {
        const publicId = this.extractPublicId(existing.image);
        if (publicId) {
          await this.cloudinary.deleteImage(publicId);
        }
      }
  
      const filename = `category-${id}-${Date.now()}`;
      imageUrl = await this.cloudinary.uploadImage(file.buffer, filename);
    }
  
    if (dto.name) {
      dto.slug = slugify(dto.name);
    }
  
    const updated = await this.categoryModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        ...(imageUrl && { image: imageUrl.secure_url }),
      },
      { new: true },
    );

    // Invalidate all category-related caches
    await this.invalidateCategoryCaches();
    
    // Remove old cache entries for this specific category
    await Promise.all([
      this.cacheService.delete(CacheKeyGenerator.category(id), 'category'),
      this.cacheService.delete(CacheKeyGenerator.category(existing.slug), 'category'),
    ]);
    
    // Cache the updated category with new keys
    if (updated) {
      await Promise.all([
        this.cacheService.set(
          CacheKeyGenerator.category(updated._id.toString()),
          updated,
          CACHE_CONFIG.TTL.LONG,
          'category'
        ),
        this.cacheService.set(
          CacheKeyGenerator.category(updated.slug),
          updated,
          CACHE_CONFIG.TTL.LONG,
          'category'
        ),
      ]);
    }

    this.logger.debug(`Updated category: ${existing.name} -> ${updated?.name || existing.name}`);
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.categoryModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Category not found');

    if (deleted.image) {
      const publicId = this.extractPublicId(deleted.image);
      if (publicId) {
        await this.cloudinary.deleteImage(publicId);
      }
    }

    // Invalidate all category-related caches
    await this.invalidateCategoryCaches();
    
    // Remove specific cache entries for this category
    await Promise.all([
      this.cacheService.delete(CacheKeyGenerator.category(id), 'category'),
      this.cacheService.delete(CacheKeyGenerator.category(deleted.slug), 'category'),
    ]);

    this.logger.debug(`Deleted category: ${deleted.name} (ID: ${id})`);
    return deleted;
  }

  /**
   * Get simple category list (for dropdowns, etc.)
   */
  async getSimpleCategories(): Promise<{ _id: string; name: string; slug: string }[]> {
    const cacheKey = CacheKeyGenerator.simpleCategories();
    
    const cached = await this.cacheService.get(cacheKey, 'category');
    if (cached && Array.isArray(cached)) {
      this.logger.debug('Cache hit for simple categories');
      return cached;
    }

    const categories = await this.categoryModel
      .find({}, { _id: 1, name: 1, slug: 1 })
      .sort({ sortOrder: 1 });

    await this.cacheService.set(cacheKey, categories, CACHE_CONFIG.TTL.EXTENDED, 'category');
    
    this.logger.debug(`Loaded ${categories.length} simple categories from DB`);
    return categories.map(cat => ({
      _id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
    }));
  }

  /**
   * Get categories with product count
   */
  async getCategoriesWithProductCount(): Promise<any[]> {
    const cacheKey = CacheKeyGenerator.categoriesWithCount();
    
    const cached = await this.cacheService.get(cacheKey, 'category');
    if (cached && Array.isArray(cached)) {
      this.logger.debug('Cache hit for categories with product count');
      return cached;
    }

    // This would require aggregation with product collection
    // Implementation depends on your product schema
    const categories = await this.categoryModel.aggregate([
      {
        $lookup: {
          from: 'products', // Adjust collection name as needed
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          image: 1,
          productCount: { $size: '$products' }
        }
      },
      { $sort: { sortOrder: 1 } }
    ]);

    await this.cacheService.set(cacheKey, categories, CACHE_CONFIG.TTL.MEDIUM, 'category');
    
    this.logger.debug(`Loaded ${categories.length} categories with product count from DB`);
    return categories;
  }

  /**
   * Invalidate all category-related caches
   */
  private async invalidateCategoryCaches(): Promise<void> {
    await this.cacheService.invalidateMultipleTags([
      CacheTag.CATEGORY,
      CacheTag.ALL_CATEGORIES,
      CacheTag.CATEGORY_SEARCH,
      CacheTag.CATEGORY_WITH_COUNT,
    ]);
    
    this.logger.debug('Invalidated all category caches');
  }

  /**
   * Cache individual categories for faster access
   */
  private async cacheIndividualCategories(categories: Category[]): Promise<void> {
    const cachePromises = categories.flatMap(category => [
      this.cacheService.set(
        CacheKeyGenerator.category(category._id.toString()),
        category,
        CACHE_CONFIG.TTL.LONG,
        'category'
      ),
      this.cacheService.set(
        CacheKeyGenerator.category(category.slug),
        category,
        CACHE_CONFIG.TTL.LONG,
        'category'
      ),
    ]);

    await Promise.allSettled(cachePromises);
    this.logger.debug(`Cached ${categories.length} individual categories`);
  }

  /**
   * Prefetch categories (for warmup)
   */
  async prefetchCategories(pages: number = CACHE_CONFIG.PREFETCH_PAGES): Promise<void> {
    const prefetchPromises = [];
    
    // Prefetch first few pages
    for (let page = 1; page <= pages; page++) {
      prefetchPromises.push(this.findAll(page, 10));
    }
    
    // Prefetch simple categories
    prefetchPromises.push(this.getSimpleCategories());
    
    await Promise.allSettled(prefetchPromises);
    this.logger.log(`Prefetched ${pages} pages of categories`);
  }

  /**
   * Get cache metrics for categories
   */
  async getCacheMetrics(): Promise<any> {
    const metrics = await this.cacheService.getMetrics();
    return {
      ...metrics,
      categorySpecific: {
        memorySize: metrics.categoryMemoryCache.size,
        maxMemorySize: metrics.categoryMemoryCache.maxSize,
        memoryUtilization: `${((metrics.categoryMemoryCache.size / metrics.categoryMemoryCache.maxSize) * 100).toFixed(2)}%`,
      },
    };
  }
}