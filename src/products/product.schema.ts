/* eslint-disable prettier/prettier */
/**
 * Product Schema
 * 
 * This schema defines the structure of the Product document in MongoDB.
 */


import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category: string;

  @Prop()
  subcategory: string;

  @Prop()
  brandName: string;

  @Prop({ required: true })
  unit: string;

  @Prop({ required: true, unique: true })
  SKU: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: string;

  @Prop({ default: true })
  isAvailable: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
