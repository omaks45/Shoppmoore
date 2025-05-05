/* eslint-disable prettier/prettier */
import {
    WebSocketGateway,
    WebSocketServer,
  } from '@nestjs/websockets';
  import { Server } from 'socket.io';
  
  @WebSocketGateway({ cors: true }) // Enable CORS for frontend and mobile
  export class ProductGateway {
    @WebSocketServer()
    server: Server;
  
    emitProductUpdated(product: any) {
      this.server.emit('productUpdated', product);
    }
  
    emitProductDeleted(productId: string) {
      this.server.emit('productDeleted', { id: productId });
    }
  }
  