/* eslint-disable prettier/prettier */
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Normalize headers (Express converts headers to lowercase)
    const apiKey = request.headers['x-api-key'] || request.headers['X-API-KEY'];

    const expectedApiKey = this.configService.get<string>('ADMIN_CREATION_SECRET')?.trim();

    //console.log('Received API Key:', apiKey);
    //console.log('Expected API Key:', expectedApiKey);

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new ForbiddenException('Invalid API key: You are not authorized to create an admin');
    }

    return true;
  }
}
