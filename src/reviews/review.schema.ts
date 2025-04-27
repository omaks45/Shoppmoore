/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // now references actual User

  @Prop({ type: Types.ObjectId, ref: 'Product', required: false })
  productId?: Types.ObjectId; // references Product if it's a product review

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ default: 'product', enum: ['product', 'service'] })
  reviewType: 'product' | 'service';
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
