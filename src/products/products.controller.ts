/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductService } from '../products/products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';
//import { Roles } from '../auth/decorators/roles.decorator';
//import { RolesGuard } from '../auth/guards/roles.guard';
//import { UserRole } from '../user/user.schema';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create new product (Admin only)' })
  @ApiResponse({ status: 201, description: 'Product created successfully.' })
  async create(
    @Body() createDto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.create(createDto, file, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all available products with optional search & pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of products.' })
  async findAll(
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
    @Query('search') search?: string,
  ) {
    return this.productService.findAll(page, limit, search);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get products by category (public)' })
  @ApiResponse({ status: 200, description: 'Filtered products by category.' })
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
  ) {
    return this.productService.findByCategory(categoryId, page, limit);
  }

  @Get('admin/my-products')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get current admin’s products (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Admin’s product dashboard list.' })
  async getAdminProducts(
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
    @Req() req: any,
  ) {
    return this.productService.getAdminProducts(req.user._id, page, limit);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  @ApiResponse({ status: 200, description: 'Product updated successfully.' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.update(id, updateDto, file, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Soft delete a product (Admin only)' })
  @ApiResponse({ status: 200, description: 'Product soft-deleted successfully.' })
  async softDelete(@Param('id') id: string, @Req() req: any) {
    return this.productService.softDelete(id, req.user);
  }

  @Get('stock-out')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get stock-out products (admin)' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiResponse({ status: 200, description: 'List of stock-out products.' })
  async stockOut(
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    return this.productService.stockOut(category, minPrice, maxPrice);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (public)' })
  @ApiResponse({ status: 200, description: 'Product found.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }
}
