/* eslint-disable prettier/prettier */

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
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

// New interface for stock validation
interface StockValidationResult {
  isValid: boolean;
  message?: string;
  availableStock?: number;
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
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
    // Set cache ttl to 5 minutes
    this.cacheTTL = 300;
    
    // Determine environment
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Get all keys that match a pattern using Redis SCAN
   * @param pattern Pattern to match keys
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
   * Invalidate all cache keys associated with a specific tag
   */
  private async invalidateCacheTag(tag: CacheTag): Promise<void> {
    let pattern = '';
    
    switch (tag) {
      case CacheTag.PRODUCT:
        pattern = 'product:*';
        break;
      case CacheTag.ADMIN_PRODUCTS:
        pattern = 'admin:products:*';
        break;
      case CacheTag.ALL_PRODUCTS:
        pattern = 'products:*';
        break;
      case CacheTag.STOCK_OUT:
        pattern = 'stockout:*';
        break;
    }
    
    if (pattern) {
      const keys = await this.getKeysByPattern(pattern);
      if (keys.length > 0) {
        const promises = keys.map(key => this.cacheManager.del(key));
        await Promise.all(promises);
        this.logger.debug(`Invalidated ${keys.length} keys for tag: ${tag}`);
      }
    }
  }

  /**
   * Invalidate all admin product caches for a specific admin
   */
  private async invalidateAdminProductCaches(adminId: string): Promise<void> {
    const pattern = `admin:products:${adminId}:*`;
    const keys = await this.getKeysByPattern(pattern);
    
    if (keys.length > 0) {
      const promises = keys.map(key => this.cacheManager.del(key));
      await Promise.all(promises);
      this.logger.debug(`Invalidated ${keys.length} admin product cache keys for admin: ${adminId}`);
    }
  }

  /**
   * Smart rehydration for homepage or listing page
   */
  private async rehydrateAllProductsCache(): Promise<void> {
    const { data, metadata } = await this.findAllFromDb(1, 10);
    const key = `products:all:page:1:limit:10:search:none`;
    await this.cacheManager.set(key, { data, metadata }, this.cacheTTL);
  }

  /**
   * Smart rehydration for a specific admin's product dashboard
   */
  private async rehydrateAdminProductsCache(adminId: string, page: number, limit: number): Promise<void> {
    const response = await this.getAdminProductsFromDb(adminId, page, limit);
    const cacheKey = `admin:products:${adminId}:page:${page}:limit:${limit}`;
    await this.cacheManager.set(cacheKey, response, this.cacheTTL);
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
  
    // Validate stock count and maxOrderLimit
    if (createDto.stockCount === undefined || createDto.stockCount < 0) {
      throw new BadRequestException('Stock count is required and must be a non-negative number');
    }
    
    if (createDto.maxOrderLimit === undefined) {
      createDto.maxOrderLimit = createDto.stockCount;
    }
    
    // Cap to stock count
    if (createDto.maxOrderLimit > createDto.stockCount) {
      createDto.maxOrderLimit = createDto.stockCount;
    }
    
    // Ensure it does not fall below 1 unless stock is 0
    if (createDto.stockCount === 0) {
      createDto.maxOrderLimit = 0;
      createDto.isAvailable = false;
    } else if (createDto.maxOrderLimit < 1) {
      createDto.maxOrderLimit = 1;
      createDto.isAvailable = true;
    } else {
      createDto.isAvailable = true;
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
  
    // Validate stock updates
    if (updateDto.stockCount !== undefined) {
      if (updateDto.stockCount < 0) {
        throw new BadRequestException('Stock count must be a non-negative number');
      }

      // Update maxOrderLimit if necessary
      if (updateDto.maxOrderLimit === undefined) {
        // If maxOrderLimit not provided in the update but stockCount is less than current maxOrderLimit
        if (updateDto.stockCount < product.maxOrderLimit) {
          product.maxOrderLimit = updateDto.stockCount;
        }
      } else {
        // Ensure maxOrderLimit is not greater than stockCount
        if (updateDto.maxOrderLimit > updateDto.stockCount) {
          updateDto.maxOrderLimit = updateDto.stockCount;
        }
      }

      // Update availability based on stock
      updateDto.isAvailable = updateDto.stockCount > 0;
    } else if (updateDto.maxOrderLimit !== undefined) {
      // If only maxOrderLimit is provided, ensure it's not greater than current stock
      if (updateDto.maxOrderLimit > product.stockCount) {
        updateDto.maxOrderLimit = product.stockCount;
      }
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
    const filter: any = { stockCount: 0 }; // Updated from isAvailable: false to stockCount: 0
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
      .select('name SKU category unit price stockCount maxOrderLimit')  // Added stockCount and maxOrderLimit
      .exec();

    await this.cacheManager.set(cacheKey, products, this.cacheTTL);
    
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
    
    return response;
  }

  /**
   * Find products by category
   */
  async findByCategory(categoryId?: string, page = 1, limit = 10, refresh = false) {
    const filter: any = {
      isDeleted: false,
      isAvailable: true,
      stockCount: { $gt: 0 }, // Only show products with stock
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
    
    return response;
  }

  /**
   * Get popular products
   */
  async getPopularProducts(limit = 10): Promise<Product[]> {
    try {
      // Validate limit
      const safeLimit = Number(limit);
      if (isNaN(safeLimit) || safeLimit <= 0 || safeLimit > 100) {
        throw new BadRequestException('Invalid limit value. Must be between 1 and 100.');
      }
  
      const cacheKey = `products:popular:limit:${safeLimit}`;
      const cached = await this.cacheManager.get<Product[]>(cacheKey);
      if (cached) return cached;
  
      const popularProducts = await this.productModel
        .find({ isDeleted: false, stockCount: { $gt: 0 } }) // Only show products with stock
        .sort({ salesCount: -1 }) // or views
        .limit(safeLimit)
        .populate('category', 'name')
        .exec();
  
      await this.cacheManager.set(cacheKey, popularProducts, this.cacheTTL);
  
      return popularProducts;
    } catch (error) {
      this.logger.error('Error fetching popular products', error);
      throw new InternalServerErrorException('Failed to fetch popular products.');
    }
  }

  /**
   * Validate stock availability and enforce order limits
   * @param productId Product ID
   * @param requestedQuantity Quantity requested by customer
   * @returns Validation result
   */
  async validateOrderQuantity(productId: string, requestedQuantity: number): Promise<StockValidationResult> {
    if (requestedQuantity <= 0) {
      return { 
        isValid: false, 
        message: 'Requested quantity must be greater than zero' 
      };
    }

    const product = await this.findById(productId);
    
    // Check if product exists and is available
    if (!product || !product.isAvailable) {
      return { 
        isValid: false, 
        message: 'Product is not available',
        availableStock: 0
      };
    }

    // Check if requested quantity exceeds available stock
    if (requestedQuantity > product.stockCount) {
      return {
        isValid: false,
        message: `Only ${product.stockCount} items available in stock`,
        availableStock: product.stockCount
      };
    }

    // Check if requested quantity exceeds maximum order limit
    if (requestedQuantity > product.maxOrderLimit) {
      return {
        isValid: false,
        message: `Maximum order limit is ${product.maxOrderLimit} items per order`,
        availableStock: product.stockCount
      };
    }

    return {
      isValid: true,
      availableStock: product.stockCount
    };
  }

  /**
   * Update product stock after a successful order
   * @param productId Product ID
   * @param quantity Quantity ordered
   */
  async updateStockAfterOrder(productId: string, quantity: number): Promise<void> {
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (quantity > product.stockCount) {
      throw new BadRequestException(`Insufficient stock. Only ${product.stockCount} items available`);
    }

    // Update stock count
    product.stockCount -= quantity;
    
    // Update sales count
    product.salesCount = (product.salesCount || 0) + quantity;
    
    // Update availability if stock becomes 0
    if (product.stockCount === 0) {
      product.isAvailable = false;
    }

    await product.save();

    // Invalidate cache for this product
    await this.cacheManager.del(`product:${productId}`);
    await this.invalidateCacheTag(CacheTag.ALL_PRODUCTS);
    
    // If stock is 0, update stock-out cache
    if (product.stockCount === 0) {
      await this.invalidateCacheTag(CacheTag.STOCK_OUT);
    }
    
    // Notify connected clients via WebSockets if in production
    if (this.isProd) {
      this.notificationGateway.notifyProductUpdated(product);
    }
  }

  /**
   * Bulk validate order quantities
   * @param items Array of {productId, quantity} objects
   * @returns Validation results for each item
   */
  async validateBulkOrderQuantities(items: { productId: string; quantity: number }[]): Promise<{
    isValid: boolean;
    invalidItems: Array<{ productId: string; message: string }>;
  }> {
    const validationPromises = items.map(item => 
      this.validateOrderQuantity(item.productId, item.quantity)
        .then(result => ({ productId: item.productId, result }))
    );
    
    const results = await Promise.all(validationPromises);
    
    const invalidItems = results
      .filter(item => !item.result.isValid)
      .map(item => ({
        productId: item.productId,
        message: item.result.message
      }));
    
    return {
      isValid: invalidItems.length === 0,
      invalidItems
    };
  }

  /**
   * Get low stock products (for admin notifications)
   * @param threshold Stock threshold to consider "low"
   */
  async getLowStockProducts(threshold = 5): Promise<Product[]> {
    const cacheKey = `products:lowstock:threshold:${threshold}`;
    const cached = await this.cacheManager.get<Product[]>(cacheKey);
    if (cached) return cached;

    const lowStockProducts = await this.productModel
      .find({ 
        isDeleted: false, 
        stockCount: { $gt: 0, $lte: threshold } 
      })
      .select('name SKU category stockCount maxOrderLimit price')
      .exec();

    await this.cacheManager.set(cacheKey, lowStockProducts, this.cacheTTL);
    
    return lowStockProducts;
  }
}