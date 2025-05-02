/* eslint-disable prettier/prettier */
import {
  Controller, Post, Body, Get, Delete, Patch,   Req, //UseGuards,
  UseGuards,
  Query
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { RemoveFromCartDto } from './dto/remove-from-cart.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
//import { JwtAuthGuard } from '../auth/auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';


//@UseGuards(JwtAuthGuard)

@UseGuards(AuthGuard('jwt'), TokenBlacklistGuard)
@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add item to cart' })
  addToCart(@Req() req, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user._id, dto);
  }

  @Patch('update')
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateItem(@Req() req, @Body() dto: UpdateCartItemDto) {
    return this.cartService.updateCartItem(req.user._id, dto);
  }

  @Post('remove')
  @ApiOperation({ summary: 'Remove item from cart' })
  removeFromCart(@Req() req, @Body() dto: RemoveFromCartDto) {
    return this.cartService.removeFromCart(req.user._id, dto.productId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user cart (paginated)' })
  getCart(@Req() req, @Query('page') page = '1', @Query('limit') limit = '10') {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
  
    return this.cartService.getCart(req.user._id, pageNumber, limitNumber);
  }
  
  @Delete('clear')
  @ApiOperation({ summary: 'Clear cart' })
  clearCart(@Req() req) {
    return this.cartService.clearCart(req.user._id);
  }
}
