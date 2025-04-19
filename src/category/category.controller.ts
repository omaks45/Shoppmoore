/* eslint-disable prettier/prettier */
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Express } from 'express';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard'

@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new product category (Admin only)',
    description: 'Allows an admin to create a new product category with optional image upload.',
  })
  @ApiBearerAuth()
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      dto.image = file;
    }
    return this.categoryService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all active categories (Public)',
    description: 'Returns a cached and paginated list of all active categories for filtering and display.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.categoryService.findAll(Number(page), Number(limit));
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search categories by keyword (Public)',
    description: 'Search for categories by name. Supports partial and case-insensitive matches.',
  })
  @ApiQuery({ name: 'keyword', required: true, example: 'groceries' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  search(
    @Query('keyword') keyword: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.categoryService.searchByName(keyword, Number(page), Number(limit));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific category by ID (Public)',
    description: 'Returns a single category based on its MongoDB ID.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the category' })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a category (Admin only)',
    description: 'Allows an admin to rename or modify a category with optional image update.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the category' })
  @ApiBearerAuth()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      dto.image = file;
    }
    return this.categoryService.update(id, dto);
  }

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
