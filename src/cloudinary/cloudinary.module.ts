/* eslint-disable prettier/prettier */
/**
 * Cloudinary Module
 * 
 * This module is responsible for handling all interactions with Cloudinary.
 * It imports the ConfigModule to ensure that environment variables are available.
 * The CloudinaryService is provided for use in other modules.
 */

import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // ensures .env values are available
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService], // expose to other modules
})
export class CloudinaryModule {}
