/* eslint-disable prettier/prettier */
/**
 * Cloudinary Provider
 * 
 * This provider is responsible for configuring and providing the Cloudinary service instance.
 * It uses the ConfigService to retrieve the necessary credentials from environment variables.
 * The Cloudinary service is used for image and video management, including uploading, transforming, and delivering media assets.
 */

import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: async (configService: ConfigService) => {
    cloudinary.config({
      cloud_name: configService.get('CLOUDINARY_NAME'),
      api_key: configService.get('CLOUDINARY_KEY'),
      api_secret: configService.get('CLOUDINARY_SECRET'),
    });

    return cloudinary;
  },
  inject: [ConfigService],
};
