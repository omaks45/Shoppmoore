/* eslint-disable prettier/prettier */
// src/category/category.controller.ts

import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from '../cartegory/cartegory.service';
import { CreateCategoryDto } from '../cartegory/dto/create-cartegory.dto';
import { UpdateCategoryDto } from '../cartegory/dto/update-cartegory.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Admin-only endpoint to create a new category.
   * Used for pre-defining the list of product categories.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new product category (Admin only)',
    description: 'Allows an admin to create a new product category, e.g., Groceries, Furniture, Toys.',
  })
  @ApiBearerAuth()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  /**
   * Public endpoint to retrieve all active categories.
   * Cached in memory for faster access.
   */
  @Get()
  @ApiOperation({
    summary: 'Get all active categories (Public)',
    description: 'Returns a cached list of all active categories for filtering and display.',
  })
  findAll() {
    return this.categoryService.findAll();
  }

  /**
   * Public endpoint to search for categories using a keyword.
   * Useful for filtering category list or auto-suggestions.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Search categories by keyword (Public)',
    description: 'Search for a category by name. Supports partial and case-insensitive matches.',
  })
  @ApiQuery({ name: 'keyword', required: true, example: 'groceries' })
  search(@Query('keyword') keyword: string) {
    return this.categoryService.searchByName(keyword);
  }

  /**
   * Public endpoint to retrieve a category by ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific category by ID (Public)',
    description: 'Returns a single category based on its MongoDB ID.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the category' })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  /**
   * Admin-only endpoint to update a category.
   * Useful for renaming or toggling active status.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a category (Admin only)',
    description: 'Allows an admin to rename or modify a category.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the category' })
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  /**
   * Admin-only endpoint to delete a category.
   * Used to permanently remove a category from the system.
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a category (Admin only)',
    description: 'Allows an admin to delete a category permanently. This should be done with caution.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the category' })
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
