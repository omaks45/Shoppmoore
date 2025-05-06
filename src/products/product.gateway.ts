/* eslint-disable prettier/prettier */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Product } from '../products/product.schema';

interface CustomJwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

@WebSocketGateway({ cors: true })
export class ProductGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly configService: ConfigService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    try {
      const payload = jwt.verify(token, this.configService.get<string>('JWT_SECRET')) as CustomJwtPayload;
      console.log(`Client connected: ${payload.userId}`);
    } catch { 
      console.warn('WebSocket connection rejected due to invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitProductUpdated(product: Product) {
    this.server.emit('productUpdated', product); // You can narrow this down with rooms or user targeting
  }

  emitProductDeleted(productId: string) {
    this.server.emit('productDeleted', { id: productId });
  }
}
