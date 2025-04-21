/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UserModule } from './users/users.module';
import { ProductModule } from './products/products.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CategoryModule } from './category/category.module';
import { OrderModule } from './order/order.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    CacheModule.register({ isGlobal: true }), // global cache setup
    AuthModule,
    NotificationsModule,
    UserModule,
    ProductModule,
    CloudinaryModule,
    CategoryModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
