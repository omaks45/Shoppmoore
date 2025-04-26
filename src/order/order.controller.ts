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
//import { RolesGuard } from '../common/guards/roles.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';


@UseInterceptors(CacheInterceptor)
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order by a buyer' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fetch a specific order by its ID (for buyer)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  getOrder(@Param('orderId') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get('buyer/:buyerId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fetch all orders for a specific buyer' })
  @ApiParam({ name: 'buyerId', description: 'Unique identifier of the buyer' })
  getBuyerOrders(@Param('buyerId') buyerId: string) {
    return this.orderService.getOrdersByBuyer(buyerId);
  }

  // === Admin Routes ===

  @Get('/admin/orders')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Fetch all orders (Admin only) with pagination support' })
  getAllOrders(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.orderService.getAllOrders(+page, +limit);
  }

  @Get('/admin/orders/:orderId')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Fetch a specific order by ID (Admin view)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  getOrderAdmin(@Param('orderId') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get('/admin/orders/buyer/:buyerId')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Fetch all orders for a specific buyer (Admin view)' })
  @ApiParam({ name: 'buyerId', description: 'Unique identifier of the buyer' })
  getBuyerOrdersAdmin(@Param('buyerId') buyerId: string) {
    return this.orderService.getOrdersByBuyer(buyerId);
  }

  @Patch('/admin/orders/:orderId/status')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Update the status of an order (Admin only)' })
  @ApiOperation({ summary: 'Update the status of an order (e.g., delivered or cancelled)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  updateStatus(@Param('orderId') id: string, @Body() dto: UpdateStatusDto) {
    return this.orderService.updateStatus(id, dto);
  }

  @Get('/admin/orders/:orderId/log')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  //@UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get all status change logs for a specific order' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  getLogs(@Param('orderId') orderId: string) {
    return this.orderService.getLogs(orderId);
  }

  @Patch('/admin/orders/:orderId/log')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Assign an admin to handle a specific order and log the assignment' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  assignAdmin(@Param('orderId') id: string, @Body('assignedBy') adminId: string) {
    return this.orderService.logAssignment(id, adminId);
  }
}
