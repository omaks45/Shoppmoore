/* eslint-disable prettier/prettier */
// src/product/product.module.ts


import { Module } from '@nestjs/common';
//const CACHE_MANAGER = 'CACHE_MANAGER';
import { ProductService } from '../products/products.service';
import { ProductController } from '../products/products.controller'
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    CloudinaryModule,
    CacheModule.register(),
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    CloudinaryService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Global guard for role-based access
    },
  ],
})
export class ProductModule {}
