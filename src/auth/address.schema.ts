/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
//import mongoose from 'mongoose';

@Schema({ _id: true }) // Let Mongoose auto-generate _id
export class Address {
  @Prop({ required: true })
  street: string;

  @Prop()
  aptOrSuite?: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  zipCode: string;
}

export type AddressDocument = Address & Document;
export const AddressSchema = SchemaFactory.createForClass(Address);
