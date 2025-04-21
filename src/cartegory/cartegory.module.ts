/* eslint-disable prettier/prettier */
// src/category/category.module.ts
import { Module } from '@nestjs/common';
import { CategoryService } from '../cartegory/cartegory.service';
import { CategoryController } from '../cartegory/cartegory.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../cartegory/schema/cartegory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
