/* eslint-disable prettier/prettier */

import { Types } from 'mongoose';

export interface PopulatedOrder {
  reference: any;
  subtotal: any;
  shippingFee: number;
  status: any;
  createdAt: any;
  _id: Types.ObjectId;
  buyer: {
    _id: Types.ObjectId;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  orderItems: {
    priceSnapshot: any;
    total: any;
    productId: {
      price: any;
      _id: Types.ObjectId;
      name: string;
    };
    quantity: number;
  }[];
  totalPrice: number;
  estimatedDeliveryDate?: Date;
}
