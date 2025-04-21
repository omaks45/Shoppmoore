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
} from '@nestjs/swagger';


@UseGuards(JwtAuthGuard)
@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  //@Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateProductDto })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    
    
  ) {
    return this.productService.create(createProductDto, file, req.user);
  }



  @Get()
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.productService.findAll(Number(page), Number(limit));
  }

  @Get('stock-out')
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
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }


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

  @Delete(':id')
  //@Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete a product (Admin only)' })
  async softDelete(
    @Param('id') id: string,
    @User() user: any,
  ) {
    return this.productService.softDelete(id, user);
  }
}
