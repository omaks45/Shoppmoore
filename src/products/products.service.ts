/* eslint-disable prettier/prettier */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  //InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/product.schema';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CategoryDocument } from '../category/schema/category.schema';
import { NotificationGateway } from '../notifications/notification.gateway';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { ConfigService } from '@nestjs/config';
import { CacheService, CacheKeyGenerator, CacheTag, CACHE_CONFIG } from '../types/cache.service';
import { PipelineStage } from 'mongoose';



// New interface for stock validation



@Injectable()
export class ProductService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateStockAfterOrder(arg0: any, quantity: any) {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(ProductService.name);
  private readonly isProd: boolean;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
    @InjectModel('Category') private readonly categoryModel: Model<CategoryDocument>,
    private readonly notificationGateway: NotificationGateway,
    private configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Optimized database query with proper indexing hints
   */
  private async findAllFromDb(page = 1, limit = 10, search?: string): Promise<PaginatedResponse<Product>> {
    const query: any = { isDeleted: false };
    
    if (search) {
      // Use text index for better performance
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    
    // Use aggregation pipeline for better performance
    const pipeline: PipelineStage[] = [
      { $match: query },
      {
        $sort: search
        ? { score: { $meta: 'textScore' }, createdAt: -1 }
        : { createdAt: -1 },
      },
      {
        $facet: {
          data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          {
            $unwind: {
              path: '$category',
              preserveNullAndEmptyArrays: true,
            },
          },
          ],
          totalCount: [{ $count: 'count' }],
        },
      } ,
    ] ;


    const [result] = await this.productModel.aggregate(pipeline);
    const totalItems = result.totalCount[0]?.count || 0;
    
    return {
      data: result.data,
      metadata: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  /**
   * Optimized admin products query
   */
  private async getAdminProductsFromDb(adminId: string, page: number, limit: number): Promise<PaginatedResponse<Product>> {
    const skip = (page - 1) * limit;
    
    const pipeline: PipelineStage[] = [
      { $match: { isDeleted: false, createdBy: adminId } },
      {
        $sort: { createdAt: -1 },
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'categories',
                localField: 'category',
                foreignField: '_id',
                as: 'category',
                pipeline: [{ $project: { name: 1 } }],
              },
            },
          {
            $unwind: {
              path: '$category',
              preserveNullAndEmptyArrays: true,
            },
          },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];


    const [result] = await this.productModel.aggregate(pipeline);
    const totalItems = result.totalCount[0]?.count || 0;

    return {
      data: result.data,
      metadata: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  /**
   * Get category products from database
   */
  private async getCategoryProductsFromDb(
    categoryId: string | undefined, 
    page: number, 
    limit: number
  ): Promise<PaginatedResponse<Product>> {
    const query: any = { isDeleted: false };
    
    if (categoryId) {
      query.category = categoryId;
    }

    const skip = (page - 1) * limit;
    
    const pipeline: PipelineStage[] = [
    
      { $match: query },
      {
        $sort: { createdAt: -1 },
      },
      {
        $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          {
            $unwind: {
             path: '$category',
             preserveNullAndEmptyArrays: true,
            },
           } ,
        ],
        totalCount: [{ $count: 'count' }],
       },
     } ,
   ] ;

    const [result] = await this.productModel.aggregate(pipeline);
    const totalItems = result.totalCount[0]?.count || 0;

    return {
      data: result.data,
      metadata: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  /**
   * Background cache warming using CacheService
   */
  private async warmupCache(): Promise<void> {
    try {
      await this.cacheService.warmup(async () => {
        // Warm up popular queries
        const warmupTasks = [
          this.findAll(1, 10), // First page
          this.getPopularProducts(10),
          this.findByCategory(undefined, 1, 10), // All categories
        ];
        
        await Promise.allSettled(warmupTasks);
      });
      
      this.logger.debug('Cache warmup completed');
    } catch (error) {
      this.logger.error('Cache warmup failed', error);
    }
  }

  /**
   * Predictive prefetching for next pages
   */
  private async prefetchNextPages(currentPage: number, limit: number, search?: string): Promise<void> {
    const prefetchTasks = [];
    
    for (let i = 1; i <= CACHE_CONFIG.PREFETCH_PAGES; i++) {
      const nextPage = currentPage + i;
      const cacheKey = CacheKeyGenerator.products(nextPage, limit, search);
      
      // Only prefetch if not already cached
      const cached = await this.cacheService.get(cacheKey, 'product');
      if (!cached) {
        prefetchTasks.push(
          this.findAllFromDb(nextPage, limit, search)
            .then(response => this.cacheService.set(cacheKey, response, CACHE_CONFIG.TTL.MEDIUM, 'product'))
            .catch(() => {}) // Ignore prefetch failures
        );
      }
    }
    
    // Execute prefetch tasks without blocking
    Promise.allSettled(prefetchTasks);
  }

  /**
   * Async cache operations using CacheService
   */
  private performAsyncCacheOperations(operation: string, userId: string, product?: Product): void {
    setImmediate(async () => {
      try {
        await this.cacheService.invalidateMultipleTags([
          CacheTag.ALL_PRODUCTS,
          CacheTag.POPULAR,
        ]);
        
        // Invalidate admin-specific caches
        await this.cacheService.invalidateAdminProductCaches(userId);
        
        // Warm up critical caches
        await this.warmupCache();
        
        // WebSocket notification
        if (this.isProd && product) {
          try {
            switch (operation) {
              case 'create':
                this.notificationGateway.notifyProductCreated(product);
                break;
              case 'update':
                this.notificationGateway.notifyProductUpdated(product);
                break;
              case 'delete':
                this.notificationGateway.notifyProductDeleted(product._id.toString());
                break;
            }
          } catch (error) {
            this.logger.error('WebSocket notification failed', error);
          }
        }
      } catch (error) {
        this.logger.error('Async cache operations failed', error);
      }
    });
  }

  /**
   * Optimized create method
   */
  async create(createDto: CreateProductDto, files: Express.Multer.File[], user: any): Promise<Product> {
    // Validate SKU uniqueness with index hint
    const existing = await this.productModel.findOne({ SKU: createDto.SKU }).hint({ SKU: 1 });
    if (existing) {
      throw new BadRequestException('Product with SKU already exists');
    }

    // Validate stock count
    if (createDto.stockCount === undefined || createDto.stockCount < 0) {
      throw new BadRequestException('Stock count is required and must be a non-negative number');
    }
    
    createDto.isAvailable = createDto.stockCount > 0;
    
    // Parallel image uploads
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

    // Cache the new product
    const cacheKey = CacheKeyGenerator.product(savedProduct._id.toString());
    await this.cacheService.set(cacheKey, savedProduct, CACHE_CONFIG.TTL.LONG, 'product');

    // Async cache operations
    this.performAsyncCacheOperations('create', user._id, savedProduct);
    
    return savedProduct;
  }

  /**
   * Optimized findAll with predictive caching using CacheService
   */
  async findAll(page = 1, limit = 10, search?: string, refresh = false): Promise<PaginatedResponse<Product>> {
    const cacheKey = CacheKeyGenerator.products(page, limit, search);
    
    if (!refresh) {
      const cached = await this.cacheService.get<PaginatedResponse<Product>>(cacheKey, 'product');
      if (cached) {
        // Predictive prefetch next page
        this.prefetchNextPages(page, limit, search);
        return cached;
      }
    }

    const response = await this.findAllFromDb(page, limit, search);
    
    // Cache with appropriate TTL
    const ttl = search ? CACHE_CONFIG.TTL.SHORT : CACHE_CONFIG.TTL.MEDIUM;
    await this.cacheService.set(cacheKey, response, ttl, 'product');
    
    // Predictive prefetch
    this.prefetchNextPages(page, limit, search);
    
    return response;
  }

  /**
   * Get products by admin using CacheService
   */
  async getProductsByAdmin(adminId: string, page = 1, limit = 10): Promise<PaginatedResponse<Product>> {
    const cacheKey = CacheKeyGenerator.adminProducts(adminId, page, limit);
    
    const cached = await this.cacheService.get<PaginatedResponse<Product>>(cacheKey, 'product');
    if (cached) return cached;

    const response = await this.getAdminProductsFromDb(adminId, page, limit);
    
    await this.cacheService.set(cacheKey, response, CACHE_CONFIG.TTL.MEDIUM, 'product');
    
    return response;
  }

  /**
   * Optimized update method using CacheService
   */
  async update(
    id: string,
    updateDto: UpdateProductDto,
    files?: Express.Multer.File[],
    user?: any,
  ): Promise<Product> {
    const product = await this.productModel.findById(id).hint({ _id: 1 });
    if (!product) throw new NotFoundException('Product not found');

    // Parallel image processing
    if (files && files.length > 0) {
      const uploads = await Promise.all(
        files.map(file =>
          this.cloudinaryService.uploadImage(file.buffer, file.originalname),
        ),
      );
      product.imageUrls = uploads.map(upload => upload.secure_url);
    }

    // Stock validation
    if (updateDto.stockCount !== undefined) {
      if (updateDto.stockCount < 0) {
        throw new BadRequestException('Stock count must be a non-negative number');
      }
      updateDto.isAvailable = updateDto.stockCount > 0;
    }

    Object.assign(product, updateDto, { updatedBy: user._id });
    const updatedProduct = await product.save();

    // Update product cache
    const cacheKey = CacheKeyGenerator.product(id);
    await this.cacheService.set(cacheKey, updatedProduct, CACHE_CONFIG.TTL.LONG, 'product');

    // Async cache operations
    this.performAsyncCacheOperations('update', user._id, updatedProduct);
    
    return updatedProduct;
  }

  /**
   * Optimized soft delete using CacheService
   */
  async softDelete(id: string, user: any): Promise<{ message: string }> {
    const product = await this.productModel.findById(id).hint({ _id: 1 });
    if (!product || product.isDeleted) {
      throw new NotFoundException('Product not found or already deleted');
    }

    Object.assign(product, {
      isDeleted: true,
      deletedBy: user._id,
    });

    await product.save();

    // Remove from cache
    const cacheKey = CacheKeyGenerator.product(id);
    await this.cacheService.delete(cacheKey, 'product');

    // Async cache operations
    this.performAsyncCacheOperations('delete', user._id, product);
    
    return { message: 'Product successfully soft-deleted' };
  }

  /**
   * Optimized findById using CacheService
   */
  async findById(id: string): Promise<Product> {
    const cacheKey = CacheKeyGenerator.product(id);
    
    const cached = await this.cacheService.get<Product>(cacheKey, 'product');
    if (cached && !cached.isDeleted) return cached;

    const product = await this.productModel
      .findOne({ _id: id, isDeleted: false })
      .populate('category', 'name')
      .hint({ _id: 1 });
      
    if (!product) throw new NotFoundException('Product not found');

    await this.cacheService.set(cacheKey, product, CACHE_CONFIG.TTL.LONG, 'product');
    
    return product;
  }

  /**
   * Find products by category using CacheService
   */
  async findByCategory(
    categoryId: string | undefined, 
    page = 1, 
    limit = 10
  ): Promise<PaginatedResponse<Product>> {
    const cacheKey = CacheKeyGenerator.categoryProducts(categoryId || 'all', page, limit);
    
    const cached = await this.cacheService.get<PaginatedResponse<Product>>(cacheKey, 'product');
    if (cached) return cached;

    const response = await this.getCategoryProductsFromDb(categoryId, page, limit);
    
    await this.cacheService.set(cacheKey, response, CACHE_CONFIG.TTL.MEDIUM, 'product');
    
    return response;
  }

  /**
   * Optimized stock operations with batch processing
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateBulkOrderQuantities(items: { productId: string; quantity: number; }[], quantity: any): Promise<{
    message: any;
    isValid: boolean;
    invalidItems: Array<{ productId: string; message: string }>;
  }> {
    // Try to get products from cache first
    const cachedProducts = new Map<string, Product>();
    const uncachedIds: string[] = [];
    
    for (const item of items) {
      const cacheKey = CacheKeyGenerator.product(item.productId);
      const cached = await this.cacheService.get<Product>(cacheKey, 'product');
      if (cached) {
        cachedProducts.set(item.productId, cached);
      } else {
        uncachedIds.push(item.productId);
      }
    }
    
    // Batch fetch uncached products
    let uncachedProducts: Product[] = [];
    if (uncachedIds.length > 0) {
      uncachedProducts = await this.productModel
        .find({ _id: { $in: uncachedIds }, isDeleted: false })
        .select('_id stockCount isAvailable')
        .hint({ _id: 1 });
      
      // Cache the fetched products
      for (const product of uncachedProducts) {
        const cacheKey = CacheKeyGenerator.product(product._id.toString());
        await this.cacheService.set(cacheKey, product, CACHE_CONFIG.TTL.LONG, 'product');
      }
    }
    
    // Combine cached and uncached products
    const allProducts = new Map<string, Product>([
      ...Array.from(cachedProducts.entries()),
      ...uncachedProducts.map<[string, Product]>(p => [p._id.toString(), p])
    ]);
    
    const invalidItems = items
      .map(item => {
        const product = allProducts.get(item.productId) as Product | undefined;
        
        if (!product || !product.isAvailable) {
          return { productId: item.productId, message: 'Product is not available' };
        }
        
        if (item.quantity > product.stockCount) {
          return { 
            productId: item.productId, 
            message: `Only ${product.stockCount} items available in stock` 
          };
        }
        
        return null;
      })
      .filter(Boolean);
    
    return {
      message: invalidItems.length === 0 ? 'All items are valid' : 'Some items are invalid',
      isValid: invalidItems.length === 0,
      invalidItems
    };
  }

  /**
   * Update stock quantities in bulk
   */
  async updateBulkStock(updates: { productId: string; newStock: number }[]): Promise<void> {
    const session = await this.productModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        const bulkOps = updates.map(update => ({
          updateOne: {
            filter: { _id: update.productId },
            update: { 
              stockCount: update.newStock,
              isAvailable: update.newStock > 0
            }
          }
        }));
        
        await this.productModel.bulkWrite(bulkOps, { session });
        
        // Update cache for each product
        for (const update of updates) {
          const cacheKey = CacheKeyGenerator.product(update.productId);
          const product = await this.cacheService.get<Product>(cacheKey, 'product');
          if (product) {
            product.stockCount = update.newStock;
            product.isAvailable = update.newStock > 0;
            await this.cacheService.set(cacheKey, product, CACHE_CONFIG.TTL.LONG, 'product');
          }
        }
      });
    } finally {
      await session.endSession();
    }
    
    // Invalidate related caches
    await this.cacheService.invalidateMultipleTags([
      CacheTag.ALL_PRODUCTS,
      CacheTag.STOCK_OUT,
      CacheTag.POPULAR
    ]);
  }

  /**
   * Optimized popular products using CacheService
   */
  async getPopularProducts(limit = 10): Promise<Product[]> {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const cacheKey = CacheKeyGenerator.popular(safeLimit);
    
    const cached = await this.cacheService.get<Product[]>(cacheKey, 'product');
    if (cached) return cached;

    const pipeline: PipelineStage[] = [
      { $match: { isDeleted: false, stockCount: { $gt: 0 } } },
      { $sort: { salesCount: -1, createdAt: -1 } },
      { $limit: safeLimit },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ];

    const popularProducts = await this.productModel.aggregate(pipeline);
    
    await this.cacheService.set(cacheKey, popularProducts, CACHE_CONFIG.TTL.MEDIUM, 'product');
    
    return popularProducts;
  }

  /**
   * Get out of stock products using CacheService
   */
  async getOutOfStockProducts(page = 1, limit = 10): Promise<PaginatedResponse<Product>> {
    const filterString = `page:${page}_limit:${limit}`;
    const cacheKey = CacheKeyGenerator.stockOut(filterString);
    
    const cached = await this.cacheService.get<PaginatedResponse<Product>>(cacheKey, 'product');
    if (cached) return cached;

    const skip = (page - 1) * limit;
    
    const pipeline: PipelineStage[] = [
      { $match: { isDeleted: false, stockCount: 0 } },
      { $sort: { updatedAt: -1 as -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'categories',
                localField: 'category',
                foreignField: '_id',
                as: 'category',
                pipeline: [{ $project: { name: 1 } }]
              }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [result] = await this.productModel.aggregate(pipeline);
    const totalItems = result.totalCount[0]?.count || 0;
    
    const response = {
      data: result.data,
      metadata: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
    
    await this.cacheService.set(cacheKey, response, CACHE_CONFIG.TTL.SHORT, 'product');
    
    return response;
  }

  /**
   * Get low stock products using CacheService
   */
  async getLowStockProducts(threshold = 10): Promise<Product[]> {
    const cacheKey = CacheKeyGenerator.lowStock(threshold);
    
    const cached = await this.cacheService.get<Product[]>(cacheKey, 'product');
    if (cached) return cached;

    const pipeline: PipelineStage[] = [
      { 
        $match: { 
          isDeleted: false, 
          stockCount: { $gt: 0, $lte: threshold } 
        } 
      },
      { $sort: { stockCount: 1, updatedAt: -1 } },
      { $limit: 50 }, // Reasonable limit for low stock alerts
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ];

    const lowStockProducts = await this.productModel.aggregate(pipeline);
    
    await this.cacheService.set(cacheKey, lowStockProducts, CACHE_CONFIG.TTL.SHORT, 'product');
    
    return lowStockProducts;
  }

  /**
   * Search products with caching
   */
  async searchProducts(keyword: string, page = 1, limit = 10): Promise<PaginatedResponse<Product>> {
    // Use the existing findAll method which already handles search
    return this.findAll(page, limit, keyword);
  }

  /**
   * Get cache metrics using CacheService
   */
  async getCacheMetrics(): Promise<any> {
    return this.cacheService.getMetrics();
  }

  /**
   * Manual cache warming endpoint for admins
   */
  async warmCaches(): Promise<void> {
    await this.warmupCache();
  }

  /**
   * Clear all product-related caches
   */
  async clearProductCaches(): Promise<void> {
    await this.cacheService.invalidateMultipleTags([
      CacheTag.PRODUCT,
      CacheTag.ALL_PRODUCTS,
      CacheTag.ADMIN_PRODUCTS,
      CacheTag.POPULAR,
      CacheTag.STOCK_OUT
    ]);
  }

  /**
   * Refresh specific product cache
   */
  async refreshProductCache(id: string): Promise<Product> {
    const cacheKey = CacheKeyGenerator.product(id);
    await this.cacheService.delete(cacheKey, 'product');
    return this.findById(id);
  }
}