/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { HttpModule } from '@nestjs/axios';
import { OrderModule } from '../order/order.module';
import { AuthModule } from '../auth/auth.module/auth.module';
import { CartModule } from 'src/cart/cart.module';

@Module({
  imports: [HttpModule, forwardRef(() => OrderModule),
    forwardRef(() => AuthModule), 
    forwardRef(() => CartModule)
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
