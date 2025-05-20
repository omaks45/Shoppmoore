/* eslint-disable prettier/prettier */
/**
 * Product Schema
 * 
 * This schema defines the structure of the Product document in MongoDB.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
//import { Category } from '../category/schema/category.schema';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {

  _id?: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Category' })
  category: mongoose.Schema.Types.ObjectId;


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

  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  popularity: { type: number, default: 0 }

  @Prop({ required: true, min: 0 })
  availableQuantity: number;
  
  @Prop({ default: 100, min: 0 }) 
  maxOrderLimit: number;


  @Prop({ default: 0 })
  stockOutCount: number;

  @Prop({ default: 0 })
  salesCount: number;
  
  @Prop({ default: 0 })
  stockCount: number;
  
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  createdBy: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  updatedBy?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null })
  deletedBy?: mongoose.Schema.Types.ObjectId;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
