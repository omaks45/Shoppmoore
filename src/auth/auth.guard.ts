/* eslint-disable prettier/prettier */
import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    if (err || !user) {
      throw new ForbiddenException('Authentication failed: No user found.');
    }

    const request = context.switchToHttp().getRequest();
    request.user = user;

    return user;
  }
}
