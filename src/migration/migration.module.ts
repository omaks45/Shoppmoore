/* eslint-disable prettier/prettier */
// src/migration/migration.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/auth.schema';
import { MigrationService } from './migration.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [MigrationService],
})
export class MigrationModule {}
