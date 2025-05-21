/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Address, AddressSchema } from './address.schema'; 

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

  @Prop({ default: false }) //Instead of enum role
  isAdmin: boolean;

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

  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];


  @Prop({ default: 'https://ui-avatars.com/api/?name=User&background=random' })
  profileImage?: string;

  @Prop()
  profileImagePublicId?: string;
  
}

export type UserDocument = User & Document & {
  addresses: (Address & mongoose.Types.Subdocument)[];
};

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