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

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createDto: CreateProductDto, file?: Express.Multer.File, user?: any): Promise<Product> {
    const existing = await this.productModel.findOne({ SKU: createDto.SKU });
    if (existing) throw new BadRequestException('Product with SKU already exists');
  
    let imageUrl: string;
    if (file) {
      const result = await this.cloudinaryService.uploadImage(file.buffer, file.originalname);
      imageUrl = result.secure_url;
    }
  
    const newProduct = new this.productModel({
      ...createDto,
      imageUrl,
      createdBy: user._id, //track creator
    });
  
    await this.cacheManager.del('products:all');
    return newProduct.save();
  }

  async findAll(page = 1, limit = 10): Promise<{ data: Product[]; total: number }> {
    const cached = await this.cacheManager.get<{ data: Product[]; total: number }>('products:all');
    if (cached) return cached;

    const total = await this.productModel.countDocuments();
    const data = await this.productModel
      .find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    await this.cacheManager.set('products:all', { data, total }, 60);
    return { data, total };
  }

  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) return cached;

    const product = await this.productModel.findById(id);
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
  

  async stockOut(): Promise<any[]> {
    return this.productModel
      .find({ isAvailable: false })
      .select('name SKU category unit price')
      .exec();
  }
}
