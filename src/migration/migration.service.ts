/* eslint-disable prettier/prettier */
// src/migration/migration.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/auth.schema'; // Adjust path if needed

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger('MigrationService');

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async onModuleInit() {
    if (process.env.RUN_MIGRATION === 'true') {
      this.logger.log('RUN_MIGRATION is true. Running address migration...');
      try {
        const result = await this.userModel.updateMany(
          { address: { $exists: true } },
          [
            { $set: { addresses: ['$address'] } },
            { $unset: 'address' },
          ]
        );
        this.logger.log(`Address migration complete. Modified ${result.modifiedCount} user(s).`);
      } catch (error) {
        this.logger.error('Address migration failed', error);
      }
    }
  }
}
