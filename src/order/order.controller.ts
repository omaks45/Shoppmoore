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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';

@UseInterceptors(CacheInterceptor)
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // === Public/Buyer Routes ===

  @Post()
  @ApiOperation({ summary: 'Create a new order by a buyer (legacy method)' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Post('from-cart')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Create order from cart (optimized for payment flow)' })
  @ApiResponse({ status: 201, description: 'Order created from cart successfully' })
  @ApiResponse({ status: 400, description: 'Cart is empty or stock validation failed' })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  createOrderFromCart(
    @Body('buyerId') buyerId: string,
    @Body('paymentReference') paymentReference?: string
  ) {
    return this.orderService.createOrderFromCart(buyerId, paymentReference);
  }

  @Post('mark-paid/:reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as paid using payment reference (webhook endpoint)' })
  @ApiParam({ name: 'reference', description: 'Payment reference from payment gateway' })
  @ApiResponse({ status: 200, description: 'Order marked as paid successfully' })
  @ApiResponse({ status: 404, description: 'Order not found for the given reference' })
  async markOrderAsPaid(@Param('reference') reference: string) {
    await this.orderService.markOrderAsPaid(reference);
    return { message: 'Order marked as paid successfully' };
  }

  @Get('by-reference/:reference')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get order by payment reference' })
  @ApiParam({ name: 'reference', description: 'Payment or order reference' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getOrderByReference(@Param('reference') reference: string) {
    return this.orderService.getOrderByPaymentReference(reference);
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fetch a specific order by its ID (for buyer)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getOrder(@Param('orderId') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get('buyer/:buyerId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fetch all orders for a specific buyer' })
  @ApiParam({ name: 'buyerId', description: 'Unique identifier of the buyer' })
  @ApiResponse({ status: 200, description: 'Buyer orders retrieved successfully' })
  getBuyerOrders(@Param('buyerId') buyerId: string) {
    return this.orderService.getOrdersByBuyer(buyerId);
  }

  // === Admin Routes ===

  @Get('/admin/orders')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Fetch all orders (Admin only) with pagination support' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved with pagination info' })
  getAllOrders(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.orderService.getAllOrders(+page, +limit);
  }

  @Get('/admin/orders/recent')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get recent orders for dashboard (Admin only)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of recent orders (default: 10)' })
  @ApiResponse({ status: 200, description: 'Recent orders retrieved successfully' })
  getRecentOrders(@Query('limit') limit = 10) {
    return this.orderService.getRecentOrders(+limit);
  }

  @Get('/admin/orders/statistics')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get order statistics for dashboard (Admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order statistics including counts by status and total revenue' 
  })
  getOrderStatistics() {
    return this.orderService.getOrderStats();
  }

  @Get('/admin/orders/:orderId')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Fetch a specific order by ID (Admin view)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getOrderAdmin(@Param('orderId') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get('/admin/orders/buyer/:buyerId')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Fetch all orders for a specific buyer (Admin view)' })
  @ApiParam({ name: 'buyerId', description: 'Unique identifier of the buyer' })
  @ApiResponse({ status: 200, description: 'Buyer orders retrieved successfully' })
  getBuyerOrdersAdmin(@Param('buyerId') buyerId: string) {
    return this.orderService.getOrdersByBuyer(buyerId);
  }

  @Patch('/admin/orders/:orderId/status')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Update the status of an order (Admin only)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updateStatus(@Param('orderId') id: string, @Body() dto: UpdateStatusDto) {
    return this.orderService.updateStatus(id, dto);
  }

  @Get('/admin/orders/:orderId/logs')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Get all status change logs for a specific order' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  @ApiResponse({ status: 200, description: 'Order logs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getOrderLogs(@Param('orderId') orderId: string) {
    return this.orderService.getLogs(orderId);
  }

  @Patch('/admin/orders/:orderId/assign')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Assign an admin to handle a specific order and log the assignment' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  @ApiResponse({ status: 200, description: 'Admin assigned to order successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  assignAdmin(@Param('orderId') id: string, @Body('adminId') adminId: string) {
    return this.orderService.logAssignment(id, adminId);
  }

  // === Notification Routes (Admin) ===

  @Post('/admin/orders/:orderId/send-notification')
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Manually send order notification email (Admin only)' })
  @ApiParam({ name: 'orderId', description: 'Unique identifier of the order' })
  @ApiResponse({ status: 200, description: 'Notification sent successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async sendOrderNotification(
    @Param('orderId') orderId: string,
    @Body('status') status: string
  ) {
    await this.orderService.sendOrderNotification(orderId, status as any);
    return { message: 'Notification sent successfully' };
  }
}