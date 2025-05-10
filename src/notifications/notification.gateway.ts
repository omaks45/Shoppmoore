/* eslint-disable prettier/prettier */
import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { OnModuleInit, Logger } from '@nestjs/common';
import { Product } from '../products/product.schema';

// Define WebSocket event enums for better organization
export enum NotificationEvents {
  // Review events
  NEW_REVIEW = 'new-review',
  REVIEW_UPDATED = 'review_updated',
  REVIEW_DELETED = 'review_deleted',
  
  // Product events
  PRODUCT_CREATED = 'product:created',
  PRODUCT_UPDATED = 'product:updated',
  PRODUCT_DELETED = 'product:deleted',
}

@WebSocketGateway({
  cors: {
    origin: [], // We will override this in OnModuleInit
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(NotificationGateway.name);
  
  @WebSocketServer()
  server: Server;
  
  private allowedOrigins: string[];
  
  constructor(private readonly configService: ConfigService) {}
  
  onModuleInit() {
    const origins = this.configService.get<string>('ALLOWED_ORIGINS') || '';
    this.allowedOrigins = origins.split(',').map(origin => origin.trim());
    
    if (this.server) {
      // Dynamically update allowed origins after module initialized
      this.server.sockets.adapter.nsp.server.engine.opts.allowRequest = (req, callback) => {
        const origin = req.headers.origin;
        if (!origin || this.allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback('Origin not allowed', false);
        }
      };
    }
    
    this.logger.log(`WebSocket server initialized with allowed origins: ${this.allowedOrigins}`);
  }
  
  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }
  
  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }
  
  // ============== REVIEW NOTIFICATIONS ==============
  
  sendNewReviewNotification(review: any) {
    this.logger.debug(`Emitting new review notification for review: ${review._id}`);
    this.server.emit(NotificationEvents.NEW_REVIEW, {
      message: 'A new review has been posted!',
      review,
    });
  }
  
  sendReviewUpdatedNotification(review: any) {
    this.logger.debug(`Emitting review updated notification for review: ${review._id}`);
    this.server.to(review.userId.toString()).emit(NotificationEvents.REVIEW_UPDATED, {
      reviewId: review._id.toString(),
      content: review.content,
    });
  }
  
  sendReviewDeletedNotification(review: any) {
    this.logger.debug(`Emitting review deleted notification for review: ${review._id}`);
    this.server.to(review.userId.toString()).emit(NotificationEvents.REVIEW_DELETED, {
      reviewId: review._id.toString(),
    });
  }
  
  // ============== PRODUCT NOTIFICATIONS ==============
  
  /**
   * Notify clients about a new product creation
   */
  emitProductCreated(product: Product) {
    this.logger.debug(`Emitting product created event for product: ${product._id}`);
    this.server.emit(NotificationEvents.PRODUCT_CREATED, {
      message: 'New product created',
      product,
    });
  }
  
  /**
   * Notify clients about a product update
   */
  emitProductUpdated(product: Product) {
    this.logger.debug(`Emitting product updated event for product: ${product._id}`);
    this.server.emit(NotificationEvents.PRODUCT_UPDATED, {
      message: 'Product updated',
      product,
    });
  }
  
  /**
   * Notify clients about a product deletion
   */
  emitProductDeleted(productId: string) {
    this.logger.debug(`Emitting product deleted event for product: ${productId}`);
    this.server.emit(NotificationEvents.PRODUCT_DELETED, {
      message: 'Product deleted',
      productId,
    });
  }
  
  // Aliases for product notification methods (for backward compatibility)
  notifyProductCreated(product: Product) {
    this.emitProductCreated(product);
  }
  
  notifyProductUpdated(product: Product) {
    this.emitProductUpdated(product);
  }
  
  notifyProductDeleted(productId: string) {
    this.emitProductDeleted(productId);
  }
}