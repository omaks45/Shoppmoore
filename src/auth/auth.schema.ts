/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'admin',
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

  // @Prop({ required: true, unique: true })
  @Prop({ enum: UserRole, default: UserRole.BUYER })
  role: UserRole;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verificationCode?: string;
  
  @Prop()
  verificationCodeExpires?: Date;


  @Prop()
  passwordResetToken?: string; 

  @Prop()
  passwordResetExpires?: Date; 

  @Prop({ type: Object })
  address?: {
    street: string;
    aptOrSuite?: string;
    city: string;
    country: string;
    zipCode: string;
  };
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
     ret.id = ret._id;
     delete ret._id;
     delete ret.password; // Remove password from response
  },
});
