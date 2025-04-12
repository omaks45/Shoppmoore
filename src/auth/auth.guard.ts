/* eslint-disable prettier/prettier */
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth/auth.service/auth.service.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Invalid token format');
    }

    // Check blacklist
    const isBlacklisted = await this.authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Let Passport verify and attach the user automatically
    return (await super.canActivate(context)) as boolean;
  }

  /*
  handleRequest(err, user, info) {
    if (err || !user) {
      console.log('JWT validation failed:', info?.message || err?.message);
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
  */

  handleRequest(err, user, info, context: ExecutionContext) {
    if (err || !user) {
      throw new ForbiddenException('Authentication failed: No user found.');
    }

    const request = context.switchToHttp().getRequest();
    request.user = user; //Attach user to request

    return user;
  }
}
