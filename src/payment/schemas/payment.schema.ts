/* eslint-disable prettier/prettier */
// src/payment/schemas/payment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../auth/auth.schema'; // adjust path as needed

@Schema({ timestamps: true })
export class Payment extends Document {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    user: User | Types.ObjectId;

  @Prop({ required: true })
  reference: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['pending', 'success', 'failed'] })
  status: 'pending' | 'success' | 'failed';

  @Prop()
  paymentMethod?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
