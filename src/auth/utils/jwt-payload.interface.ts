/* eslint-disable prettier/prettier */
export interface JwtPayload {
    userId: string;
    email: string;
    role: 'admin' | 'buyer';
  }
  