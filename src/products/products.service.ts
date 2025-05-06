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
import { CategoryDocument } from '../category/schema/category.schema'
import { ProductGateway } from './product.gateway';

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
    @InjectModel('Category') private readonly categoryModel: Model<CategoryDocument>,
    private readonly productGateway: ProductGateway, 
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


  /// Find all products with optional search and pagination
  /// This method retrieves all products from the database, with optional search functionality and pagination.
  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{
    data: Product[];
    metadata: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  }> {
    const query: any = { isDeleted: false };
  
    // Add case-insensitive search if provided
    if (search) {
      query.name = { $regex: new RegExp(search, 'i') };
    }
  
    const skip = (page - 1) * limit;
    const cacheKey = `products:all:page:${page}:limit:${limit}:search:${search || 'none'}`;
  
    const cached = await this.cacheManager.get<{
      data: Product[];
      metadata: any;
    }>(cacheKey);
    if (cached) return cached;
  
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
    const response = {
      data,
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    };
  
    await this.cacheManager.set(cacheKey, response, 60); // Cache for 60 seconds
    return response;
  }  

   
  // Fetch all products for admin with pagination
  // This method retrieves all products created by a specific admin, with pagination support.
  async getAdminProducts(adminId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
  
    const [products, total] = await Promise.all([
      this.productModel
        .find({ createdBy: adminId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name'),
      this.productModel.countDocuments({ createdBy: adminId }),
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
  


  /// Find a product by its ID
  /// This method retrieves a product from the database and caches it for future requests.
  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached && !cached.isDeleted) return cached;
  
    const product = await this.productModel.findOne({ _id: id, isDeleted: false });
    if (!product) throw new NotFoundException('Product not found');
  
    await this.cacheManager.set(cacheKey, product, 60);
    return product;
  }
  

      // product.service.ts

  async update(
    id: string,
    updateDto: UpdateProductDto,
    file?: Express.Multer.File,
    user?: any,
  ): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Product not found');

    if (file) {
      const { secure_url } = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);
      product.imageUrl = secure_url;
    }

    Object.assign(product, updateDto, { updatedBy: user._id });

    await Promise.all([
      this.cacheManager.del(`product:${id}`),
      product.save(),
    ]);

    this.productGateway.emitProductUpdated(product);

    return product;
  }

  async softDelete(id: string, user: any): Promise<{ message: string }> {
    const product = await this.productModel.findById(id);
    if (!product || product.isDeleted) {
      throw new NotFoundException('Product not found or already deleted');
    }

    Object.assign(product, {
      isDeleted: true,
      deletedBy: user._id,
    });

    await Promise.all([
      product.save(),
      this.cacheManager.del(`product:${id}`),
      this.cacheManager.del('products:all'),
    ]);

    this.productGateway.emitProductDeleted(id);

    return { message: 'Product successfully soft-deleted' };
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
  
  
  // finds a product by its category ID
  // This method retrieves all products that belong to a specific category.
  async findByCategory(
    categoryId?: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: Product[];
    metadata: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  }> {
    const filter: any = {
      isDeleted: false,
      isAvailable: true,
    };
  
    if (categoryId) {
      filter.category = categoryId;
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
}
