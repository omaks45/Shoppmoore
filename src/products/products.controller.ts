/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  //Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  ParseIntPipe,
  UploadedFiles,
  ParseBoolPipe,
  DefaultValuePipe,
  Patch,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { ProductService } from '../products/products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';
import { Product } from './product.schema';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
//import { StockValidationResult } from './dto/stock-validation-result.dto';



@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@UseInterceptors(FilesInterceptor('images')) // 'images' field matches Swagger
@ApiConsumes('multipart/form-data')
@ApiOperation({ summary: 'Create a new product with multiple images' })
@ApiBody({
  description: 'Product creation data including images',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', example: 'Wireless Mouse' },
      category: { type: 'string', example: 'Electronics' },
      subcategory: { type: 'string', example: 'Computer Accessories' },
      brandName: { type: 'string', example: 'Logitech' },
      unit: { type: 'string', example: 'pcs' },
      SKU: { type: 'string', example: 'WM-2023-BLK' },
      price: { type: 'number', example: 5999 },
      description: { type: 'string', example: 'Ergonomic wireless mouse...' },
      availableQuantity: { type: 'number', example: 100 },
      maxOrderLimit: { type: 'number', example: 10 },
      isAvailable: { type: 'boolean', example: true },
      stockOutCount: { type: 'number', example: 0 },
      salesCount: { type: 'number', example: 0 },
      stockCount: { type: 'number', example: null },
      images: {
        type: 'array',
        items: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  },
})
@ApiResponse({ status: 201, description: 'Product successfully created' })
@ApiResponse({ status: 400, description: 'Invalid input or SKU conflict' })
async create(
  @UploadedFiles() files: Express.Multer.File[],
  @Body() createDto: CreateProductDto,
  @CurrentUser() user: { _id: string }

): Promise<Product> {
  return this.productService.create(createDto, files || [], user);
}


  @Get()
  @ApiOperation({ summary: 'Get all available products with optional search & pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force cache refresh' })
  @ApiResponse({ status: 200, description: 'List of products.' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Query('search') search?: string,
    @Query('refresh', new DefaultValuePipe(false), ParseBoolPipe) refresh = false,
  ) {
    return this.productService.findAll(page, limit, search, refresh);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get products by category (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force cache refresh' })
  @ApiResponse({ status: 200, description: 'Filtered products by category.' })
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Query('refresh', new DefaultValuePipe(false), ParseBoolPipe) refresh = false,
  ) {
    return this.productService.findByCategory(categoryId, page, limit, refresh);
  }

  @Get('admin/my-products')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: "Get current admin's products (paginated)" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force cache refresh' })
  @ApiResponse({ status: 200, description: "Admin's product dashboard list." })
  async getAdminProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Query('refresh', new DefaultValuePipe(false), ParseBoolPipe) refresh = false,
    @Req() req: any,
  ) {
    return this.productService.getAdminProducts(req.user._id, page, limit, refresh);
  }

  @ApiOperation({ summary: 'Update an existing product' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product successfully updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  //@Roles(Role.ADMIN)
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]))
  update(
    @Param('id') id: string,
    @UploadedFiles() files: { images?: Express.Multer.File[] },
    @Body() updateDto: UpdateProductDto,
    @CurrentUser() user: any,
  ): Promise<Product> {
    return this.productService.update(id, updateDto, files?.images, user);
  }
  
  
  @Delete(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Soft delete a product (Admin only)' })
  @ApiResponse({ status: 200, description: 'Product soft-deleted successfully.' })
  async softDelete(@Param('id') id: string, @Req() req: any) {
    return this.productService.softDelete(id, req.user);
  }



  @ApiOperation({ summary: 'Get stock-out products' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of out-of-stock products' })
  @Get('/stock-out')
  stockOut(
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('includeDeleted') includeDeleted = false,
    @Query('refresh') refresh = false,
  ): Promise<any[]> {
    return this.productService.stockOut(category, minPrice, maxPrice, includeDeleted, refresh);
  }
  


  @ApiOperation({ summary: 'Get popular products sorted by sales' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of products to return' })
  @ApiResponse({ status: 200, description: 'Popular products returned successfully' })
  @Get('/popular')
  getPopularProducts(@Query('limit') limit = 10): Promise<Product[]> {
    return this.productService.getPopularProducts(limit);
  }
  



  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (public)' })
  @ApiResponse({ status: 200, description: 'Product found.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }

 

  @ApiOperation({ summary: 'Update product stock after order is placed' })
  @ApiParam({ name: 'productId' })
  @ApiQuery({ name: 'quantity', type: Number })
  @ApiResponse({ status: 200, description: 'Stock updated' })
  @Patch('/reduce-stock/:productId')
  @UseGuards(JwtAuthGuard)
  updateStockAfterOrder(
    @Param('productId') productId: string,
    @Query('quantity') quantity: number,
  ): Promise<void> {
    return this.productService.updateStockAfterOrder(productId, quantity);
  }
  

  @ApiOperation({ summary: 'Validate multiple product quantities in one request' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Bulk validation result returned' })
  @Post('/validate/bulk')
  validateBulk(
    @Body() body: { items: { productId: string; quantity: number }[] }
  ): Promise<{
    isValid: boolean;
    invalidItems: Array<{ productId: string; message: string }>;
  }> {
    return this.productService.validateBulkOrderQuantities(body.items);
  }
  
  
}