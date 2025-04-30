/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument } from 'mongoose';

export type OrderLogDocument = HydratedDocument<OrderLog>;

export enum OrderAction {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
  REFUNDED = 'refunded',
  FAILED = 'failed',
  SYSTEM_UPDATE = 'system_update',
}

@Schema({ timestamps: true })
export class OrderLog {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ enum: OrderAction, required: true })
  action: OrderAction;

  @Prop({ type: String })
  comment?: string;

  // Either a User (admin/buyer) or system
  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  @Prop({ default: 'user' })
  actorType: 'user' | 'system';

  // Optional metadata for extra info (e.g. old values, payload)
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const OrderLogSchema = SchemaFactory.createForClass(OrderLog);
