/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard';
import { UserModule } from './users/users.module';
import { ProductModule } from './products/products.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';


@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),
    

    // Connect to MongoDB using environment variables
    MongooseModule.forRoot(process.env.MONGODB_URI),

    AuthModule,

    NotificationsModule,

    UserModule,

    ProductModule,

    CloudinaryModule 
  ],
  controllers: [AppController],
  providers: [AppService,  {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },
  ],
})
export class AppModule {}
