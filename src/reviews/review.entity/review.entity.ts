/* eslint-disable prettier/prettier */
export class ReviewEntity {
    id: string;
    userId: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    productId?: {
      _id: string;
      title: string;
      price: number;
    };
    content: string;
    rating: number;
    reviewType: 'product' | 'service';
    createdAt: Date;
    updatedAt: Date;
  }
  