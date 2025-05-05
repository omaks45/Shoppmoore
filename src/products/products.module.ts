/* eslint-disable prettier/prettier */
// src/product/product.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';

import { ProductService } from '../products/products.service';
import { ProductController } from '../products/products.controller';
import { Product, ProductSchema } from './product.schema';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module/auth.module';
import { CategorySchema } from '../category/schema/category.schema';
import { ProductGateway } from './product.gateway';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema },
      { name: 'Category', schema: CategorySchema }, 
    ]),
    CloudinaryModule,
    CacheModule.register(),
    forwardRef(() => AuthModule), //Use forwardRef to resolve circular dependency
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    ProductGateway,
  ],
})
export class ProductModule {}
