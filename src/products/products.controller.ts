/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  //Req,
  ParseIntPipe,
  UploadedFiles,
  ParseBoolPipe,
  DefaultValuePipe,
  Patch,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { ProductService } from '../products/products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TokenBlacklistGuard } from 'src/common/guards/token-blacklist.guard';
import { Product } from './product.schema';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @UseInterceptors(FilesInterceptor('images'))
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
        price: { type: 'number', example: 5999 },
        description: { type: 'string', example: 'Ergonomic wireless mouse...' },
        availableQuantity: { type: 'number', example: 100 },
        
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
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search keyword' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force cache refresh' })
  @ApiResponse({ status: 200, description: 'Paginated list of products with metadata' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Query('search') search?: string,
    @Query('refresh', new DefaultValuePipe(false), ParseBoolPipe) refresh = false,
  ) {
    return this.productService.findAll(page, limit, search, refresh);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products with keyword (public)' })
  @ApiQuery({ name: 'keyword', required: true, type: String, description: 'Search keyword' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Search results with pagination' })
  async searchProducts(
    @Query('keyword') keyword: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.productService.searchProducts(keyword, page, limit);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get products by category (public)' })
  @ApiParam({ name: 'categoryId', description: 'Category ID (use "all" for all categories)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force cache refresh' })
  @ApiResponse({ status: 200, description: 'Filtered products by category with pagination' })
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Query('refresh', new DefaultValuePipe(false), ParseBoolPipe) refresh = false,
  ) {
    const resolvedCategoryId = categoryId === 'all' ? undefined : categoryId;
    return this.productService.findByCategory(resolvedCategoryId, page, limit);
  }

  @Get('admin/my-products')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: "Get current admin's products (paginated)" })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: "Admin's product dashboard with pagination" })
  async getAdminProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @CurrentUser() user: { _id: string },
  ) {
    return this.productService.getProductsByAdmin(user._id, page, limit);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular products sorted by sales count' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of products (default: 10, max: 100)' })
  @ApiResponse({ status: 200, description: 'Popular products returned successfully' })
  async getPopularProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10
  ): Promise<Product[]> {
    return this.productService.getPopularProducts(limit);
  }

  @Get('stock-out')
  @ApiOperation({ summary: 'Get out-of-stock products with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Paginated list of out-of-stock products' })
  async getOutOfStockProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.productService.getOutOfStockProducts(page, limit);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock products below threshold' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Stock threshold (default: 10)' })
  @ApiResponse({ status: 200, description: 'List of low stock products' })
  async getLowStockProducts(
    @Query('threshold', new DefaultValuePipe(10), ParseIntPipe) threshold = 10
  ): Promise<Product[]> {
    return this.productService.getLowStockProducts(threshold);
  }

  @Get('cache/metrics')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get cache performance metrics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cache metrics returned successfully' })
  async getCacheMetrics() {
    return this.productService.getCacheMetrics();
  }

  @Post('cache/warm')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Manually warm up caches (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cache warming initiated' })
  async warmCaches() {
    await this.productService.warmCaches();
    return { message: 'Cache warming completed successfully' };
  }

  @Delete('cache/clear')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Clear all product-related caches (Admin only)' })
  @ApiResponse({ status: 200, description: 'Caches cleared successfully' })
  async clearProductCaches() {
    await this.productService.clearProductCaches();
    return { message: 'Product caches cleared successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (public)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product found with populated category' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findById(@Param('id') id: string): Promise<Product> {
    return this.productService.findById(id);
  }

  @Get(':id/refresh')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Refresh specific product cache (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product cache refreshed' })
  async refreshProductCache(@Param('id') id: string): Promise<Product> {
    return this.productService.refreshProductCache(id);
  }

  @Patch(':id')
@UseGuards(JwtAuthGuard, TokenBlacklistGuard)
@UseInterceptors(FilesInterceptor('images', 5)) // Max 5 images
@ApiConsumes('multipart/form-data')
@ApiOperation({ summary: 'Update an existing product with optional images' })
@ApiParam({ name: 'id', description: 'Product ID' })
@ApiBody({
  description: 'Product update data with optional images',
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
      description: { type: 'string', example: 'Updated product description' },
      availableQuantity: { type: 'number', example: 100 },
      images: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    },
  },
})
@ApiResponse({ status: 200, description: 'Product successfully updated' })
@ApiResponse({ status: 404, description: 'Product not found' })
async update(
  @Param('id') id: string,
  @UploadedFiles() files: Express.Multer.File[], // Match create()
  @Body() updateDto: UpdateProductDto,
  @CurrentUser() user: any,
): Promise<Product> {
  return this.productService.update(id, updateDto, files || [], user);
}

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Soft delete a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async softDelete(
    @Param('id') id: string, 
    @CurrentUser() user: any
  ) {
    return this.productService.softDelete(id, user);
  }

  // Batch Operations
  @Post('validate/bulk')
  @ApiOperation({ summary: 'Validate multiple product quantities for order processing' })
  @ApiBody({
    description: 'Bulk validation request',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', example: '507f1f77bcf86cd799439011' },
              quantity: { type: 'number', example: 5 }
            },
            required: ['productId', 'quantity']
          }
        }
      },
      required: ['items']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Bulk validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        invalidItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async validateBulk(
    @Body() body: { items: { productId: string; quantity: number }[] }
  ): Promise<{
    isValid: boolean;
    invalidItems: Array<{ productId: string; message: string }>;
  }> {
    // Pass a default quantity value (e.g., null or 0) since bulk validation already includes quantities per item
    return this.productService.validateBulkOrderQuantities(body.items, null);
  }

  @Patch('stock/bulk-update')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Update stock quantities for multiple products (Admin only)' })
  @ApiBody({
    description: 'Bulk stock update request',
    schema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', example: '507f1f77bcf86cd799439011' },
              newStock: { type: 'number', example: 50 }
            },
            required: ['productId', 'newStock']
          }
        }
      },
      required: ['updates']
    }
  })
  @ApiResponse({ status: 200, description: 'Bulk stock update completed' })
  async updateBulkStock(
    @Body() body: { updates: { productId: string; newStock: number }[] }
  ): Promise<{ message: string }> {
    await this.productService.updateBulkAvailableQuantity(
      body.updates.map(({ productId, newStock }) => ({
        productId,
        newQuantity: newStock,
      }))
    );
    return { message: 'Bulk stock update completed successfully' };
  }

  // Legacy endpoint maintained for backward compatibility
  @Patch('reduce-stock/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Legacy: Update product stock after order (use bulk-update instead)',
    deprecated: true 
  })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'quantity', type: Number, description: 'Quantity to reduce' })
  @ApiResponse({ status: 200, description: 'Stock updated (deprecated - use bulk operations)' })
  async updateStockAfterOrder(
    @Param('productId') productId: string,
    @Query('quantity', ParseIntPipe) quantity: number,
  ): Promise<{ message: string }> {
    // Convert to bulk operation format
    await this.productService.updateBulkAvailableQuantity([
      { productId, newQuantity: quantity } // Note: This assumes quantity is the new stock, not reduction
    ]);
    return { message: 'Stock updated successfully' };
  }
}