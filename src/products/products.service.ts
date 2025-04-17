/* eslint-disable prettier/prettier */

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
const CACHE_MANAGER = 'CACHE_MANAGER';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/product.schema';
import { CreateProductDto} from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Cache } from 'cache-manager';

/**
 * ProductService
 * 
 * This service handles all operations related to products, including creating, updating, deleting, and retrieving products.
 * It also manages caching for performance optimization.
 * 
 */


@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(
    createDto: CreateProductDto,
    file?: Express.Multer.File,
    user?: any
  ): Promise<Product> {
    const existing = await this.productModel.findOne({ SKU: createDto.SKU });
    if (existing) {
      throw new BadRequestException('Product with SKU already exists');
    }

    let imageUrl: string | undefined;
    if (file) {
      const result = await this.cloudinaryService.uploadImage(
      file.buffer,
      file.originalname,
    );
    imageUrl = result.secure_url;
    }

    const newProduct = new this.productModel({
      ...createDto,
      imageUrl,
      createdBy: user._id,
    });

    return newProduct.save();
  }


  async findAll(page = 1, limit = 10): Promise<{ data: Product[]; total: number }> {
    const cacheKey = `products:all:page:${page}:limit:${limit}`;
    const cached = await this.cacheManager.get<{ data: Product[]; total: number }>(cacheKey);
    if (cached) return cached;
  
    const query = { isDeleted: false }; //Filter out soft-deleted products
  
    const total = await this.productModel.countDocuments(query);
    const data = await this.productModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
  
    await this.cacheManager.set(cacheKey, { data, total }, 60); // cache per page/limit combo
    return { data, total };
  }
  
  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached && !cached.isDeleted) return cached;
  
    const product = await this.productModel.findOne({ _id: id, isDeleted: false });
    if (!product) throw new NotFoundException('Product not found');
  
    await this.cacheManager.set(cacheKey, product, 60);
    return product;
  }
  

  async update(id: string, updateDto: UpdateProductDto, file?: Express.Multer.File, user?: any): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Product not found');
  
    if (file) {
      const result = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);
      product.imageUrl = result.secure_url;
    }
  
    Object.assign(product, updateDto);
    product.updatedBy = user._id; //track updater
  
    await this.cacheManager.del(`product:${id}`);
    return product.save();
  }
  
  /// Fetch products that are out of stock
  /// This method retrieves products that are marked as unavailable (isAvailable: false).
  async stockOut(
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    includeDeleted = false,
  ): Promise<any[]> {
    const filter: any = {
      isAvailable: false,
    };
  
    // Exclude soft-deleted unless admin explicitly includes them
    if (!includeDeleted) {
      filter.isDeleted = false;
    }
  
    // Optional filters
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }
  
    // Cache key includes all filters
    const cacheKey = `stockout:${JSON.stringify(filter)}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;
  
    const products = await this.productModel
      .find(filter)
      .select('name SKU category unit price')
      .exec();
  
    await this.cacheManager.set(cacheKey, products, 60); // 1 min cache
    return products;
  }
  

  // Soft delete a product by ID
  // This method marks the product as deleted without removing it from the database.
  async softDelete(id: string, user: any): Promise<{ message: string }> {
    const product = await this.productModel.findById(id);
    if (!product || product.isDeleted) {
      throw new NotFoundException('Product not found or already deleted');
    }
  
    product.isDeleted = true;
    product.deletedBy = user._id;
  
    await product.save();
  
    await this.cacheManager.del(`product:${id}`);
    await this.cacheManager.del('products:all');
  
    return { message: 'Product successfully soft-deleted' };
  }
  

}
