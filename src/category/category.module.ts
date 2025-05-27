/* eslint-disable prettier/prettier */
// src/camports: [tegory/category.module.ts
import { Module, forwardRef } from '@nestjs/common';
//import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { Category, CategorySchema } from './schema/category.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from 'src/auth/auth.module/auth.module';
import { CustomCacheModule } from 'src/types/cache/cache.module';

@Module({
  imports: [
    CustomCacheModule, 
    MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
    forwardRef(() => AuthModule),
    CloudinaryModule,
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
