/* eslint-disable prettier/prettier */

/**
 * @file order.schema.ts
 * @description Order schema for MongoDB using Mongoose
 * @module order.schema.ts
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  buyer: Types.ObjectId;

  @Prop([{
    productId: { type: Types.ObjectId, ref: 'Product' },
    quantity: Number,
  }])
  orderItems: {
    productId: Types.ObjectId;
    quantity: number;
  }[];

  @Prop()
  totalPrice: number;

  @Prop()
  paymentMethod: string;

  @Prop({ default: 'pending' })
  status: string;

  @Prop()
  estimatedDeliveryDate?: Date;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
