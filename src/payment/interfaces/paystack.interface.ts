/* eslint-disable prettier/prettier */
export interface PaystackInitResponse {
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }
  