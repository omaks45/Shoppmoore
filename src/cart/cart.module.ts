/* eslint-disable prettier/prettier */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart, CartSchema } from './schema/cart.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { AuthModule } from '../auth/auth.module/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema }
    ]),
    AuthModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [ CartService],
})
export class CartModule {}
