/* eslint-disable prettier/prettier */

/**
 * @file order-log.schema.ts
 * @description OrderLog schema for MongoDB using Mongoose
 * @module order-log.schema.ts
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument } from 'mongoose';

export type OrderLogDocument = HydratedDocument<OrderLog>;

@Schema({ timestamps: true })
export class OrderLog {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ required: true })
  action: string; // created, assigned, delivered, cancelled

  @Prop()
  comment?: string;

  @Prop({ required: true })
  performedBy: string; // adminId | buyerId | 'system'
}

export const OrderLogSchema = SchemaFactory.createForClass(OrderLog);
