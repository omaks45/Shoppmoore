/* eslint-disable prettier/prettier */
import { model } from 'mongoose';
import { UserSchema } from '../auth/auth.schema'; // Adjust if needed

export const UserModel = model('User', UserSchema);
