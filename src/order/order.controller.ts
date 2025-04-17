/* eslint-disable prettier/prettier */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';


@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles('buyer')
  @UseGuards(RolesGuard)
  createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get(':orderId')
  @Roles('buyer')
  @UseGuards(RolesGuard)
  getOrder(@Param('orderId') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get('buyer/:buyerId')
  @Roles('buyer')
  @UseGuards(RolesGuard)
  getBuyerOrders(@Param('buyerId') buyerId: string) {
    return this.orderService.getOrdersByBuyer(buyerId);
  }

  // === Admin Routes ===

  @Get('/admin/orders')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @UseInterceptors(CacheInterceptor)
  getAllOrders(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.orderService.getAllOrders(+page, +limit);
  }

  @Get('/admin/orders/:orderId')
  @Roles('admin')
  @UseGuards(RolesGuard)
  getOrderAdmin(@Param('orderId') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get('/admin/orders/buyer/:buyerId')
  @Roles('admin')
  @UseGuards(RolesGuard)
  getBuyerOrdersAdmin(@Param('buyerId') buyerId: string) {
    return this.orderService.getOrdersByBuyer(buyerId);
  }

  @Patch('/admin/orders/:orderId/status')
  @Roles('admin')
  @UseGuards(RolesGuard)
  updateStatus(@Param('orderId') id: string, @Body() dto: UpdateStatusDto) {
    return this.orderService.updateStatus(id, dto);
  }

  @Get('/admin/orders/:orderId/log')
  @Roles('admin')
  @UseGuards(RolesGuard)
  getLogs(@Param('orderId') orderId: string) {
    return this.orderService.getLogs(orderId);
  }

  @Patch('/admin/orders/:orderId/log')
  @Roles('admin')
  @UseGuards(RolesGuard)
  assignAdmin(@Param('orderId') id: string, @Body('assignedBy') adminId: string) {
    return this.orderService.logAssignment(id, adminId);
  }
}
