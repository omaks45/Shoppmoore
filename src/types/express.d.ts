/* eslint-disable prettier/prettier */
// src/types/express.d.ts
import 'express';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      isAdmin: boolean;
    }
  }
}
