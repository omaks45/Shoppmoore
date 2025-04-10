/* eslint-disable prettier/prettier */
export class ProductEntity {
    _id: string;
    name: string;
    category: string;
    subcategory?: string;
    brandName?: string;
    unit: string;
    SKU: string;
    price: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
    createdAt: Date;
    updatedAt: Date;
  
    constructor(partial: Partial<ProductEntity>) {
      Object.assign(this, partial);
    }
  }
  