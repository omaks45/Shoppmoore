/* eslint-disable prettier/prettier */

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
const CACHE_MANAGER = 'CACHE_MANAGER';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/product.schema';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Cache } from 'cache-manager';
import { CategoryDocument } from '../category/schema/category.schema';
import { NotificationGateway } from '../notifications/notification.gateway';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { ConfigService } from '@nestjs/config';

// Define cache tag enum for better organization
enum CacheTag {
  PRODUCT = 'product',
  ADMIN_PRODUCTS = 'admin_products',
  ALL_PRODUCTS = 'all_products',
  STOCK_OUT = 'stock_out',
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly cacheKeys: Map<string, Set<string>> = new Map();
  private readonly cacheTTL: number;
  private readonly isProd: boolean;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel('Category') private readonly categoryModel: Model<CategoryDocument>,
    private readonly notificationGateway: NotificationGateway,
    private configService: ConfigService,
  ) {
    // Initialize cache tag tracking
    Object.values(CacheTag).forEach(tag => {
      this.cacheKeys.set(tag, new Set<string>());
    });
    
    // Set cache TTL to 20 seconds
    this.cacheTTL = 20;
    
    // Determine environment
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Track a cache key with its associated tag
   */
  private trackCacheKey(tag: CacheTag, key: string): void {
    const tagSet = this.cacheKeys.get(tag);
    if (tagSet) {
      tagSet.add(key);
    }
  }

  /**
   * Invalidate all cache keys associated with a specific tag
   */
  private async invalidateCacheTag(tag: CacheTag): Promise<void> {
    const keys = this.cacheKeys.get(tag);
    if (keys && keys.size > 0) {
      const promises = Array.from(keys).map(key => this.cacheManager.del(key));
      await Promise.all(promises);
      this.logger.debug(`Invalidated ${keys.size} keys for tag: ${tag}`);
      keys.clear();
    }
  }

  /**
   * Invalidate all admin product caches for a specific admin
   */
  private async invalidateAdminProductCaches(adminId: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    // For in-memory cache, we need to find and delete each key individually
    const adminKeysSet = this.cacheKeys.get(CacheTag.ADMIN_PRODUCTS);
    if (adminKeysSet) {
      adminKeysSet.forEach(key => {
        if (key.includes(`admin:products:${adminId}`)) {
          keysToDelete.push(key);
        }
      });
    }
    
    // Delete the identified keys
    if (keysToDelete.length > 0) {
      const promises = keysToDelete.map(key => {
        adminKeysSet?.delete(key);
        return this.cacheManager.del(key);
      });
      await Promise.all(promises);
      this.logger.debug(`Invalidated ${keysToDelete.length} admin product cache keys for admin: ${adminId}`);
    }
  }

  /**
   * Smart rehydration for homepage or listing page
   */
  private async rehydrateAllProductsCache(): Promise<void> {
    const { data, metadata } = await this.findAllFromDb(1, 10);
    const key = `products:all:page:1:limit:10:search:none`;
    await this.cacheManager.set(key, { data, metadata }, this.cacheTTL);
    this.trackCacheKey(CacheTag.ALL_PRODUCTS, key);
  }

  /**
   * Smart rehydration for a specific admin's product dashboard
   */
  private async rehydrateAdminProductsCache(adminId: string, page: number, limit: number): Promise<void> {
    const response = await this.getAdminProductsFromDb(adminId, page, limit);
    const cacheKey = `admin:products:${adminId}:page:${page}:limit:${limit}`;
    await this.cacheManager.set(cacheKey, response, this.cacheTTL);
    this.trackCacheKey(CacheTag.ADMIN_PRODUCTS, cacheKey);
  }

  /**
   * Direct database access for admin products (no caching)
   */
  private async getAdminProductsFromDb(adminId: string, page: number, limit: number): Promise<PaginatedResponse<Product>> {
    const skip = (page - 1) * limit;
    
    const [products, total] = await Promise.all([
      this.productModel
        .find({ createdBy: adminId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name'),
      this.productModel.countDocuments({ createdBy: adminId, isDeleted: false }),
    ]);

    return {
      data: products,
      metadata: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  /**
   * Direct database access for all products (no caching)
   */
  private async findAllFromDb(page = 1, limit = 10, search?: string): Promise<PaginatedResponse<Product>> {
    const query: any = { isDeleted: false };
    if (search) {
      query.name = { $regex: new RegExp(search, 'i') };
    }

    const skip = (page - 1) * limit;
    
    const [data, totalItems] = await Promise.all([
      this.productModel
        .find(query)
        .populate('category', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.productModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      data,
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  /**
   * Create a new product
   */
  async create(createDto: CreateProductDto, files: Express.Multer.File[], user: any): Promise<Product> {
    const existing = await this.productModel.findOne({ SKU: createDto.SKU });
    if (existing) {
      throw new BadRequestException('Product with SKU already exists');
    }
  
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      const uploads = await Promise.all(
        files.map(file =>
          this.cloudinaryService.uploadImage(file.buffer, file.originalname)
        )
      );
      imageUrls = uploads.map(res => res.secure_url);
    }
  
    const newProduct = new this.productModel({
      ...createDto,
      imageUrls,
      createdBy: user._id,
    });
  
    const savedProduct = await newProduct.save();
  
    // Invalidate relevant caches
    await Promise.all([
      this.invalidateCacheTag(CacheTag.ALL_PRODUCTS),
      this.invalidateAdminProductCaches(user._id),
    ]);
    
    // Refresh critical caches
    await this.rehydrateAllProductsCache();
    await this.rehydrateAdminProductsCache(user._id, 1, 10);
    
    // Notify connected clients via WebSockets if in production
    if (this.isProd) {
      this.notificationGateway.notifyProductCreated(savedProduct);
    }
  
    return savedProduct;
  }
  
  /**
   * Find all products with pagination and optional search
   */
  async findAll(page = 1, limit = 10, search?: string, refresh = false): Promise<PaginatedResponse<Product>> {
    const cacheKey = `products:all:page:${page}:limit:${limit}:search:${search || 'none'}`;
    
    // If refresh is true, bypass cache
    if (!refresh) {
      const cached = await this.cacheManager.get<PaginatedResponse<Product>>(cacheKey);
      if (cached) return cached;
    }

    // Get from database
    const response = await this.findAllFromDb(page, limit, search);

    // Save to cache
    await this.cacheManager.set(cacheKey, response, this.cacheTTL);
    this.trackCacheKey(CacheTag.ALL_PRODUCTS, cacheKey);
    
    return response;
  }

  /**
   * Update an existing product
   */
  async update(
    id: string,
    updateDto: UpdateProductDto,
    files?: Express.Multer.File[],
    user?: any,
  ): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Product not found');
  
    // Handle new image uploads (replace old images)
    if (files && files.length > 0) {
      const uploads = await Promise.all(
        files.map(file =>
          this.cloudinaryService.uploadImage(file.buffer, file.originalname),
        ),
      );
      product.imageUrls = uploads.map(upload => upload.secure_url);
    }
  
    // Apply DTO updates and track updater
    Object.assign(product, updateDto, { updatedBy: user._id });
  
    // Save the product
    const updatedProduct = await product.save();
  
    // Invalidate all relevant caches
    await Promise.all([
      this.cacheManager.del(`product:${id}`),
      this.invalidateCacheTag(CacheTag.ALL_PRODUCTS),
      this.invalidateAdminProductCaches(user._id),
    ]);
  
    // Refresh critical caches
    await this.rehydrateAllProductsCache();
    await this.rehydrateAdminProductsCache(user._id, 1, 10);
    
    // Notify connected clients via WebSockets if in production
    if (this.isProd) {
      this.notificationGateway.notifyProductUpdated(updatedProduct);
    }
  
    return updatedProduct;
  }
  
  /**
   * Soft delete a product
   */
  async softDelete(id: string, user: any): Promise<{ message: string }> {
    const product = await this.productModel.findById(id);
    if (!product || product.isDeleted) {
      throw new NotFoundException('Product not found or already deleted');
    }

    Object.assign(product, {
      isDeleted: true,
      deletedBy: user._id,
    });

    await product.save();

    // Invalidate all relevant caches
    await Promise.all([
      this.cacheManager.del(`product:${id}`),
      this.invalidateCacheTag(CacheTag.ALL_PRODUCTS),
      this.invalidateCacheTag(CacheTag.STOCK_OUT),
      this.invalidateAdminProductCaches(user._id),
    ]);

    // Refresh critical caches
    await this.rehydrateAllProductsCache();
    await this.rehydrateAdminProductsCache(user._id, 1, 10);
    
    // Notify connected clients via WebSockets if in production
    if (this.isProd) {
      this.notificationGateway.notifyProductDeleted(id);
    }
    
    return { message: 'Product successfully soft-deleted' };
  }

  /**
   * Find a product by ID
   */
  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached && !cached.isDeleted) return cached;

    const product = await this.productModel.findOne({ _id: id, isDeleted: false });
    if (!product) throw new NotFoundException('Product not found');

    await this.cacheManager.set(cacheKey, product, this.cacheTTL);
    this.trackCacheKey(CacheTag.PRODUCT, cacheKey);
    
    return product;
  }

  /**
   * Get stock-out products
   */
  async stockOut(
    category?: string, 
    minPrice?: number, 
    maxPrice?: number, 
    includeDeleted = false,
    refresh = false
  ): Promise<any[]> {
    const filter: any = { isAvailable: false };
    if (!includeDeleted) filter.isDeleted = false;
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const cacheKey = `stockout:${JSON.stringify(filter)}`;
    
    // If refresh is true, bypass cache
    if (!refresh) {
      const cached = await this.cacheManager.get<any[]>(cacheKey);
      if (cached) return cached;
    }

    const products = await this.productModel
      .find(filter)
      .select('name SKU category unit price')
      .exec();

    await this.cacheManager.set(cacheKey, products, this.cacheTTL);
    this.trackCacheKey(CacheTag.STOCK_OUT, cacheKey);
    
    return products;
  }

  /**
   * Get products for a specific admin with pagination
   */
  async getAdminProducts(adminId: string, page: number, limit: number, refresh = false) {
    const cacheKey = `admin:products:${adminId}:page:${page}:limit:${limit}`;
    
    // If refresh is true, bypass cache
    if (!refresh) {
      const cached = await this.cacheManager.get<PaginatedResponse<Product>>(cacheKey);
      if (cached) return cached;
    }

    // Get from database
    const response = await this.getAdminProductsFromDb(adminId, page, limit);

    // Save to cache
    await this.cacheManager.set(cacheKey, response, this.cacheTTL);
    this.trackCacheKey(CacheTag.ADMIN_PRODUCTS, cacheKey);
    
    return response;
  }

  /**
   * Find products by category
   */
  async findByCategory(categoryId?: string, page = 1, limit = 10, refresh = false) {
    const filter: any = {
      isDeleted: false,
      isAvailable: true,
    };
    if (categoryId) {
      filter.category = categoryId;
    }

    const cacheKey = `category:${categoryId || 'all'}:page:${page}:limit:${limit}`;
    
    // If refresh is true, bypass cache
    if (!refresh) {
      const cached = await this.cacheManager.get<PaginatedResponse<Product>>(cacheKey);
      if (cached) return cached;
    }

    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('category', 'name')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    
    const response = {
      data,
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    };
    
    await this.cacheManager.set(cacheKey, response, this.cacheTTL);
    this.trackCacheKey(CacheTag.ALL_PRODUCTS, cacheKey);
    
    return response;
  }
}