/* eslint-disable prettier/prettier */
import {
  Controller, Post, Body, Get, Delete, Patch, UseGuards, Req
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { RemoveFromCartDto } from './dto/remove-from-cart.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';


@UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: 'Get user cart' })
  getCart(@Req() req) {
    return this.cartService.getCart(req.user._id);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear cart' })
  clearCart(@Req() req) {
    return this.cartService.clearCart(req.user._id);
  }
}
