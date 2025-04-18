/* eslint-disable prettier/prettier */

/**
 * @file order-response.dto.ts
 * @description OrderResponseDto for the response of an order
 * @module order-response.dto.ts
 */

export class OrderResponseDto {
    _id: string;
    buyer: {
      _id: string;
      fullName: string;
      email: string;
      phone: string;
      address: string;
    };
    orderItems: any[];
    totalPrice: number;
    paymentMethod: string;
    status: string;
    createdAt: Date;
  }
  