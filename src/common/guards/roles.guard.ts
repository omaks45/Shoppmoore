/* eslint-disable prettier/prettier */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
//import { UserRole } from '../../users/schemas/user.schema'; // Import UserRole

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    console.log('🔍 User object from request:', request.user); // Debugging

    if (!request.user) {
      console.log('❌ No user found on request object');
      throw new ForbiddenException('Authentication failed: No user found.');
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}

 /*
  // The canActivate method is called to determine if the request should be allowed
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Check if the route has any roles defined
    if (!requiredRoles) {
      return true; // If no roles are required, allow access
    }

    // Get the user from the request object
    const { user } = context.switchToHttp().getRequest();

    // Check if the user is authenticated and has one of the required roles
    // If the user is not authenticated or does not have the required role, throw a ForbiddenException
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
  */
