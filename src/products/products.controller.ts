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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/common/decorators/user.decorator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
// import { RolesGuard } from 'src/common/guards/roles.guard';
// import { Roles } from 'src/common/decorators/roles.decorator';
// import { UserRole } from 'src/common/enums/roles.enum';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard /*, RolesGuard */)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  // @Roles(UserRole.ADMIN) // Uncomment if role restriction is needed
  @UseInterceptors(FileInterceptor('image')) //File field name is 'image'
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateProductDto,
    description: 'Form-data including text fields and image file',
  })
  async create(
    @Body() body: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @User() user: any,
  ) {
    return this.productService.create(body, file, user);
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
  // @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image')) //Ensure same field name
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UpdateProductDto,
    description: 'Update form-data including optional new image',
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @User() user: any,
  ) {
    return this.productService.update(id, body, file, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a product by ID' })
  @ApiParam({ name: 'id', type: String })
  async softDelete(@Param('id') id: string) {
    return this.productService.softDelete(id);
  }

}
