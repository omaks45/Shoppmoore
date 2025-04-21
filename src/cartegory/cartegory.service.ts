/* eslint-disable prettier/prettier */
// src/category/category.service.ts
import {
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../cartegory/schema/cartegory.schema';
import { CreateCategoryDto } from '../cartegory/dto/create-cartegory.dto';
import { UpdateCategoryDto } from '../cartegory/dto/update-cartegory.dto';
import { Cache } from 'cache-manager';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(dto: CreateCategoryDto) {
    const newCategory = await this.categoryModel.create(dto);
    await this.cacheManager.del('categories');
    return newCategory;
  }

  async findAll() {
    const cached = await this.cacheManager.get<Category[]>('categories');
    if (cached) return cached;

    const categories = await this.categoryModel.find({ isActive: true });
    await this.cacheManager.set('categories', categories, 3600);

    return categories;
  }

  async findOne(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.categoryModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!category) throw new NotFoundException('Category not found');
    await this.cacheManager.del('categories');
    return category;
  }

  async remove(id: string) {
    const category = await this.categoryModel.findByIdAndDelete(id);
    if (!category) throw new NotFoundException('Category not found');
    await this.cacheManager.del('categories');
    return { message: 'Category deleted' };
  }

  async searchByName(keyword: string) {
    return this.categoryModel.find({
      name: { $regex: keyword, $options: 'i' },
    });
  }
}
