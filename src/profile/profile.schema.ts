/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../auth/auth.schema';

@Schema({ timestamps: true })
export class Profile extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: User | Types.ObjectId;

  @Prop({ required: true })
  profileImageUrl: string;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
