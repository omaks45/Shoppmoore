/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  buyer: Types.ObjectId;

  @Prop([{
    productId: { type: Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
  }])
  orderItems: {
    productId: Types.ObjectId;
    quantity: number;
  }[];

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true })
  paymentMethod: string;

  @Prop({ required: true, unique: true })
  reference: string;

  @Prop({ default: false })
  isPaid: boolean;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;


  @Prop({ required: true })  
  paymentReference?: string;

  @Prop({ required: true })
  paidAt?: Date;

  @Prop()
  estimatedDeliveryDate?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
