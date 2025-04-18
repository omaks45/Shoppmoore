/* eslint-disable prettier/prettier */

import { Types } from 'mongoose';

export interface PopulatedOrder {
  _id: Types.ObjectId;
  buyer: {
    _id: Types.ObjectId;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  orderItems: {
    productId: {
      _id: Types.ObjectId;
      name: string;
    };
    quantity: number;
  }[];
  totalPrice: number;
  estimatedDeliveryDate?: Date;
}
