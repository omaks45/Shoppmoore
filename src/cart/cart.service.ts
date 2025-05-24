/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schema/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Product } from '../products/product.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  private readonly SHIPPING_FEE = 750;

  private calculateCartTotal(cart: CartDocument): number {
    return cart.items.reduce((sum: number, item) => sum + item.total, 0);
  }

  private calculateTotalWithShipping(cart: CartDocument): number {
    return this.calculateCartTotal(cart) + this.SHIPPING_FEE;
  }

  async getCart(userId: Types.ObjectId, page = 1, limit = 10) {
    const cart = await this.cartModel.findOne({ userId }).populate('items.productId');

    if (!cart) {
      return {
        userId,
        items: [],
        pagination: { totalItems: 0, totalPages: 0, currentPage: page },
        totalWithShipping: this.SHIPPING_FEE,
      };
    }

    const totalItems = cart.items.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedItems = cart.items.slice((page - 1) * limit, page * limit);
    const totalWithShipping = this.calculateTotalWithShipping(cart);

    return {
      userId: cart.userId,
      items: paginatedItems,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
      },
      totalWithShipping,
    };
  }

  async addToCart(userId: Types.ObjectId, dto: AddToCartDto) {
    const product = await this.productModel.findById(dto.productId);
    if (!product) throw new NotFoundException('Product not found');

    let cart = await this.cartModel.findOne({ userId });

    if (!cart) {
      cart = new this.cartModel({ userId, items: [] });
    }

    const existingItem = cart.items.find(
      item => item.productId.toString() === dto.productId,
    );

    if (existingItem) {
      existingItem.quantity += dto.quantity;
      existingItem.total = existingItem.quantity * existingItem.priceSnapshot;
    } else {
      cart.items.push({
       productId: new Types.ObjectId(dto.productId),

        quantity: dto.quantity,
        priceSnapshot: product.price,
        total: dto.quantity * product.price,
      });
    }

    cart.markModified('items');
    await cart.save();

    return {
      cart,
      totalWithShipping: this.calculateTotalWithShipping(cart),
    };
  }

  async updateCartItem(userId: Types.ObjectId, dto: UpdateCartItemDto) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) throw new NotFoundException('Cart not found');

    const item = cart.items.find(
      item => item.productId.toString() === dto.productId,
    );
    if (!item) throw new NotFoundException('Item not found in cart');

    item.quantity = dto.quantity;
    item.total = item.quantity * item.priceSnapshot;

    cart.markModified('items');
    await cart.save();

    return {
      cart,
      totalWithShipping: this.calculateTotalWithShipping(cart),
    };
  }

  async removeFromCart(userId: Types.ObjectId, productId: string) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) throw new NotFoundException('Cart not found');

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    cart.markModified('items');
    return cart.save();
  }

  async clearCart(userId: Types.ObjectId) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) throw new NotFoundException('Cart not found');

    cart.items = [];
    cart.markModified('items');
    return cart.save();
  }
}
