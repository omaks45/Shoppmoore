/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schema/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Product } from '../products/product.schema';
import { FullCartResponse, PaginatedCartResponse, PopulatedCartItem } from 'src/common/interfaces/cart-response.interface';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectModel(Cart.name) public readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  private readonly SHIPPING_FEE = 750;

  private calculateCartTotal(cart: CartDocument): number {
    return cart.items.reduce((sum: number, item) => sum + item.total, 0);
  }

  private calculateTotalWithShipping(cart: CartDocument): number {
    return this.calculateCartTotal(cart) + this.SHIPPING_FEE;
  }

  // FIXED METHOD: Get full cart without pagination for payment processing
  async getFullCart(userId: Types.ObjectId): Promise<FullCartResponse> {
  this.logger.log(`Getting full cart for user: ${userId}`);

  const rawCart = await this.cartModel.findOne({ userId }).lean();
  if (!rawCart || rawCart.items.length === 0) {
    return {
      userId,
      items: [],
      totalWithShipping: this.SHIPPING_FEE,
    };
  }

  const cart = await this.cartModel.findOne({ userId })
    .populate<{
      items: {
        productId: Product;
        quantity: number;
        priceSnapshot: number;
        total: number;
      }[];
    }>({
      path: 'items.productId',
      model: 'Product',
      select: 'name price description images category stock',
    })
    .exec();

  if (!cart) {
    return {
      userId,
      items: [],
      totalWithShipping: this.SHIPPING_FEE,
    };
  }

  const validItems = cart.items.filter(item =>
    item.productId && item.quantity > 0 && item.priceSnapshot > 0 && item.total > 0,
  );

  const totalWithShipping =
    validItems.length > 0
      ? validItems.reduce((sum, item) => sum + item.total, 0) + this.SHIPPING_FEE
      : this.SHIPPING_FEE;

  return {
    userId: cart.userId,
    items: validItems as PopulatedCartItem[],
    totalWithShipping,
  };
}


  async getCart(userId: Types.ObjectId, page = 1, limit = 10): Promise<PaginatedCartResponse> {
  const cart = await this.cartModel
    .findOne({ userId })
    .populate<{
      items: {
        productId: Product;
        quantity: number;
        priceSnapshot: number;
        total: number;
      }[];
    }>({
      path: 'items.productId',
      model: 'Product',
      select: 'name price description images category stock',
    })
    .exec();

  if (!cart) {
    return {
      userId,
      items: [],
      totalWithShipping: this.SHIPPING_FEE,
      pagination: {
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      },
    };
  }

  const validItems = cart.items.filter(
    item => item.productId && item.quantity > 0 && item.priceSnapshot > 0,
  );

  const totalItems = validItems.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedItems = validItems.slice((page - 1) * limit, page * limit);

  const totalWithShipping =
    validItems.length > 0
      ? validItems.reduce((sum, item) => sum + item.total, 0) + this.SHIPPING_FEE
      : this.SHIPPING_FEE;

  return {
    userId: cart.userId,
    items: paginatedItems as PopulatedCartItem[],
    totalWithShipping,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
    },
  };
}


  async addToCart(userId: Types.ObjectId, dto: AddToCartDto) {
    try {
      this.logger.log(`Adding to cart for user ${userId}:`, dto);

      const product = await this.productModel.findById(dto.productId);
      if (!product) {
        this.logger.error(`Product not found: ${dto.productId}`);
        throw new NotFoundException('Product not found');
      }

      let cart = await this.cartModel.findOne({ userId });

      if (!cart) {
        this.logger.log(`Creating new cart for user: ${userId}`);
        cart = new this.cartModel({ userId, items: [] });
      }

      const existingItemIndex = cart.items.findIndex(
        item => item.productId.toString() === dto.productId,
      );

      if (existingItemIndex >= 0) {
        // Update existing item
        cart.items[existingItemIndex].quantity += dto.quantity;
        cart.items[existingItemIndex].total = 
          cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].priceSnapshot;
        
        this.logger.log(`Updated existing cart item at index ${existingItemIndex}`);
      } else {
        // Add new item
        cart.items.push({
          productId: new Types.ObjectId(dto.productId),
          quantity: dto.quantity,
          priceSnapshot: product.price,
          total: dto.quantity * product.price,
        });
        
        this.logger.log(`Added new item to cart`);
      }

      cart.markModified('items');
      await cart.save();

      this.logger.log(`Cart saved successfully. Items count: ${cart.items.length}`);

      return {
        cart,
        totalWithShipping: this.calculateTotalWithShipping(cart),
      };
    } catch (error) {
      this.logger.error(`Error adding to cart for user ${userId}:`, error);
      throw error;
    }
  }

  async updateCartItem(userId: Types.ObjectId, dto: UpdateCartItemDto) {
    try {
      const cart = await this.cartModel.findOne({ userId });
      if (!cart) throw new NotFoundException('Cart not found');

      const itemIndex = cart.items.findIndex(
        item => item.productId.toString() === dto.productId,
      );
      
      if (itemIndex === -1) {
        throw new NotFoundException('Item not found in cart');
      }

      if (dto.quantity <= 0) {
        // Remove item if quantity is 0 or negative
        cart.items.splice(itemIndex, 1);
        this.logger.log(`Removed item from cart due to zero/negative quantity`);
      } else {
        // Update quantity and total
        cart.items[itemIndex].quantity = dto.quantity;
        cart.items[itemIndex].total = cart.items[itemIndex].quantity * cart.items[itemIndex].priceSnapshot;
        this.logger.log(`Updated cart item quantity to ${dto.quantity}`);
      }

      cart.markModified('items');
      await cart.save();

      return {
        cart,
        totalWithShipping: this.calculateTotalWithShipping(cart),
      };
    } catch (error) {
      this.logger.error(`Error updating cart item for user ${userId}:`, error);
      throw error;
    }
  }

  async removeFromCart(userId: Types.ObjectId, productId: string) {
    try {
      const cart = await this.cartModel.findOne({ userId });
      if (!cart) throw new NotFoundException('Cart not found');

      const initialLength = cart.items.length;
      cart.items = cart.items.filter(item => item.productId.toString() !== productId);
      
      if (cart.items.length === initialLength) {
        this.logger.warn(`Attempted to remove non-existent item ${productId} from cart`);
      } else {
        this.logger.log(`Removed item ${productId} from cart`);
      }

      cart.markModified('items');
      return cart.save();
    } catch (error) {
      this.logger.error(`Error removing from cart for user ${userId}:`, error);
      throw error;
    }
  }

  async clearCart(userId: Types.ObjectId) {
    try {
      const cart = await this.cartModel.findOne({ userId });
      if (!cart) throw new NotFoundException('Cart not found');

      const itemCount = cart.items.length;
      cart.items = [];
      cart.markModified('items');
      
      const result = await cart.save();
      this.logger.log(`Cleared cart for user ${userId}. Removed ${itemCount} items.`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error clearing cart for user ${userId}:`, error);
      throw error;
    }
  }

  // Helper method to debug cart contents
  async debugCart(userId: Types.ObjectId) {
    try {
      const rawCart = await this.cartModel.findOne({ userId }).lean();
      const populatedCart = await this.cartModel
        .findOne({ userId })
        .populate('items.productId')
        .lean();

      return {
        raw: rawCart,
        populated: populatedCart,
        comparison: {
          rawItemsCount: rawCart?.items?.length || 0,
          populatedItemsCount: populatedCart?.items?.length || 0,
          itemsMatch: rawCart?.items?.length === populatedCart?.items?.length
        }
      };
    } catch (error) {
      this.logger.error(`Error debugging cart for user ${userId}:`, error);
      throw error;
    }
  }
}