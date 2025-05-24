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

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  @Prop({ type: String, enum: ['user', 'system'], default: 'user' })
  actorType: 'user' | 'system';

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const OrderLogSchema = SchemaFactory.createForClass(OrderLog);
