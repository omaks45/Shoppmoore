/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

  @Prop({
    type: [
      {
        street: { type: String, required: true },
        aptOrSuite: { type: String },
        city: { type: String, required: true },
        country: { type: String, required: true },
        zipCode: { type: String, required: true },
      },
    ],
    default: [],
  })
  addresses: {
    street: string;
    aptOrSuite?: string;
    city: string;
    country: string;
    zipCode: string;
  }[];


  @Prop({ default: 'https://ui-avatars.com/api/?name=User&background=random' })
  profileImage?: string;

  @Prop()
  profileImagePublicId?: string;
  
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