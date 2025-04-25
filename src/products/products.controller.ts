/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/common/decorators/user.decorator';
//import { Roles } from 'src/common/decorators/roles.decorator';
//import { RolesGuard } from 'src/common/guards/roles.guard';
//import { UserRole } from '../common/enums/roles.enum';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  //ApiParam,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiQuery,
 // ApiResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
//import { Product } from './product.schema';


@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

   
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateProductDto })
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  @ApiCreatedResponse({
    description: 'Product created successfully',
    schema: {
      example: {
        _id: '661d8e4e0e3a3f1b4c2e91f8',
        name: 'Lip Gloss',
        price: 1200,
        category: {
          _id: '660bc843c3d41b859b62e29a',
          name: 'Cosmetics',
        },
        imageUrl: 'https://cdn.cloudinary.com/lip-gloss.jpg',
        createdBy: {
          _id: '660aa843c3d41b859b62a111',
          email: 'admin@example.com',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid input data or missing fields' })
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.create(createProductDto, file, req.user);
  }
  


  // Get all products with pagination, search, and metadata
  // This method retrieves all products, allowing for pagination and search functionality.
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all available products with pagination, search, and metadata' })
  @ApiQuery({ name: 'page', required: false, example: 1, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, example: 10, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'search', required: false, example: 'Lip Gloss', type: String, description: 'Search by product name (case-insensitive)' })
  @ApiOkResponse({
    description: 'Returns paginated product list with metadata',
    schema: {
      example: {
        data: [
          {
            _id: '661c79e6f241b311f42e7bcb',
            name: 'Lip Gloss',
            SKU: 'LG-2025-01',
            category: { _id: '660bc843c3d41b859b62e29a', name: 'Cosmetics' },
            price: 1200,
            unit: 'pcs',
            imageUrl: 'https://cdn.cloudinary.com/lip-gloss.jpg',
          },
        ],
        metadata: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 10,
        },
      },
    },
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    return this.productService.findAll(Number(page), Number(limit), search);
  }
  

   
  @UseGuards(JwtAuthGuard)
  @Get('stock-out')
  @ApiOperation({ summary: 'Get products that are out of stock (Admin only)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum product price' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum product price' })
  @ApiQuery({ name: 'includeDeleted', required: false, description: 'Include soft-deleted products', example: 'true' })
  @ApiOkResponse({
    description: 'Successfully retrieved out-of-stock products',
    schema: {
      example: {
        data: [
          {
            _id: '661e8a1f1c3f1e1d2c4b9872',
            name: 'Foundation',
            stock: 0,
            price: 1500,
            category: {
              _id: '660bc843c3d41b859b62e29a',
              name: 'Cosmetics',
            },
          },
        ],
        count: 1,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No out-of-stock products found' })
  async stockOut(
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.productService.stockOut(
      category,
      minPrice ? Number(minPrice) : undefined,
      maxPrice ? Number(maxPrice) : undefined,
      includeDeleted === 'true',
    );
  }
  

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'MongoDB ID of the product',
    example: '661c79e6f241b311f42e7bcb',
  })
  @ApiOkResponse({
    description: 'Product retrieved successfully',
    schema: {
      example: {
        _id: '661c79e6f241b311f42e7bcb',
        name: 'Lip Gloss',
        category: {
          _id: '660bc843c3d41b859b62e29a',
          name: 'Cosmetics',
        },
        price: 1200,
        stock: 10,
        imageUrl: 'https://cdn.cloudinary.com/lip-gloss.jpg',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Product not found with the given ID' })
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }
  

   
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  //@Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateProductDto })
  @ApiOperation({ summary: 'Update product details (Admin only)' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @User() user: any,
  ) {
    return this.productService.update(id, updateDto, file, user);
  }

 /// Get products by category
  /// This method retrieves products that belong to a specific category.
  //@UseGuards(JwtAuthGuard)
  @Get('cat/:categoryId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated products by category' })
  @ApiParam({
    name: 'categoryId',
    required: true,
    description: 'MongoDB ID of the product category',
    example: '660bc843c3d41b859b62e29a',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number for pagination (default is 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Number of products per page (default is 10)',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved paginated products in the specified category',
    schema: {
      example: {
        data: [
          {
            _id: '661c79e6f241b311f42e7bcb',
            name: 'Lip Gloss',
            category: {
              _id: '660bc843c3d41b859b62e29a',
              name: 'Cosmetics',
            },
            price: 1200,
            unit: 'pcs',
            SKU: 'LG-2025-01',
            imageUrl: 'https://cdn.cloudinary.com/lip-gloss.jpg',
          },
        ],
        metadata: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 10,
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No products found in the specified category' })
  async getProductsByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.productService.findByCategory(categoryId, Number(page), Number(limit));
  }
  

   
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a product (Admin only)' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'MongoDB ID of the product to be soft deleted',
    example: '661c79e6f241b311f42e7bcb',
  })
  @ApiOkResponse({
    description: 'Product soft deleted successfully',
    schema: {
      example: {
        message: 'Product soft deleted',
        deletedBy: {
          _id: '660aa843c3d41b859b62a111',
          email: 'admin@example.com',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Product not found or already deleted' })
  async softDelete(@Param('id') id: string, @User() user: any) {
    return this.productService.softDelete(id, user);
  }
  
}
