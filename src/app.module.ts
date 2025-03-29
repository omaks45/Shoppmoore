/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModuleModule } from './auth/auth.module/auth.module.module';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Connect to MongoDB using environment variables
    MongooseModule.forRoot(process.env.MONGODB_URI),

    AuthModuleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
