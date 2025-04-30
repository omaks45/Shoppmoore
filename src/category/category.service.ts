/* eslint-disable prettier/prettier */
// src/category/category.service.ts
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Category, CategoryDocument } from './schema/category.schema';
import { Model } from 'mongoose';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../auth/utils/slugify';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { randomUUID } from 'crypto';
import { Cache } from 'cache-manager';
import { isValidObjectId } from 'mongoose';
//import * as path from 'path';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private readonly cloudinary: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    await this.cacheManager.del('categories');

    return saved;
  }


  

  async findAll(page = 1, limit = 10) {
    const cacheKey = `categories-page-${page}-limit-${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

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

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }


  async findByIdOrSlug(identifier: string): Promise<Category> {
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
  
    return category;
  }
   
  async searchByName(keyword: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const regex = new RegExp(keyword, 'i');

    const [results, total] = await Promise.all([
      this.categoryModel.find({ name: { $regex: regex } }).skip(skip).limit(limit),
      this.categoryModel.countDocuments({ name: { $regex: regex } }),
    ]);

    const lastPage = Math.ceil(total / limit);

    return {
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
  
    await this.cacheManager.del('categories');
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

    await this.cacheManager.del('categories');
    return deleted;
  }
}
