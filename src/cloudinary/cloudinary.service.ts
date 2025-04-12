/* eslint-disable prettier/prettier */
/**
 * Cloudinary Service
 * 
 * This service handles the interaction with Cloudinary for image uploads.
 * It uses the Cloudinary Node.js SDK to upload images to a specified folder.
 */

import { Injectable, Inject } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(@Inject('CLOUDINARY') private cloudinaryClient: typeof cloudinary) {}

  async uploadImage(buffer: Buffer, filename: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinaryClient.uploader.upload_stream(
        {
          folder: 'shopmoore/products',
          public_id: filename,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }
}
