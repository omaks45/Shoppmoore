/* eslint-disable prettier/prettier */
import { Types } from 'mongoose';
import { Product } from '../../products/product.schema';

export interface PopulatedCartItem {
  productId: Product;
  quantity: number;
  priceSnapshot: number;
  total: number;
}

export interface RawCartItem {
  productId: Types.ObjectId;
  quantity: number;
  priceSnapshot: number;
  total: number;
}

export interface FullCartResponse {
  userId: Types.ObjectId;
  items: PopulatedCartItem[];
  totalWithShipping: number;
}

export interface PaginatedCartResponse extends FullCartResponse {
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
  };
}
