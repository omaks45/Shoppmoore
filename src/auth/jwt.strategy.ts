/* eslint-disable prettier/prettier */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth/auth.service/auth.service.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET, // Ensure this is defined
    });
  }

  async validate(payload: { userId: string; email: string; role: string }) {
    console.log('✅ JWT Payload:', payload);

    if (!payload.userId) {
      console.log('❌ No userId in token payload');
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.authService.getUserById(payload.userId);
    
    if (!user) {
      console.log('❌ User not found in DB:', payload.userId);
      throw new UnauthorizedException('User not found');
    }

    console.log('✅ Authenticated user:', user);
    return user; // This should be set to req.user
  }
}
