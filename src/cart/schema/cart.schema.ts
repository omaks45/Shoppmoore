/* eslint-disable prettier/prettier */
/**
 * Cart Schema
 * This schema defines the structure of the Cart document in MongoDB.
 * It includes the user ID and an array of CartItem objects.
 * Each CartItem contains the product ID, quantity, price snapshot, and total price.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  priceSnapshot: number; // price at time of adding to cart

  @Prop()
  total: number; // price * quantity
}

@Schema({ timestamps: true })
export class Cart extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [CartItem], default: [] })
  items: CartItem[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);
