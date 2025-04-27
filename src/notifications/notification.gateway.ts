/* eslint-disable prettier/prettier */
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [], // We will override this in OnModuleInit
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
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

    console.log('WebSocket allowed origins:', this.allowedOrigins);
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  sendNewReviewNotification(review: any) {
    this.server.emit('new-review', {
      message: 'A new review has been posted!',
      review,
    });
  }
}
