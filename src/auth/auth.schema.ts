/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Removed duplicate declaration of UserDocument

enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  BUYER = 'buyer',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop({ enum: UserRole, default: UserRole.USER })
  role: UserRole;
  

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verificationCode?: string;

  @Prop()
  resetPasswordToken?: string;

  @Prop({ type: Object })
  address?: {
    street: string;
    aptOrSuite?: string;
    city: string;
    country: string;
    zipCode: string;
  };
}

//export const UserSchema = SchemaFactory.createForClass(User);
export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);