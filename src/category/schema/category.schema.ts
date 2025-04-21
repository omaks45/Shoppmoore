/* eslint-disable prettier/prettier */
// src/category/entities/category.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description?: string;

  @Prop({ required: true }) // Expecting just a string URL
  image: string;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export type CategoryDocument = Category & Document;

export const CategorySchema = SchemaFactory.createForClass(Category);
