/* eslint-disable prettier/prettier */
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    email: string;
    role: string;
  };
}
