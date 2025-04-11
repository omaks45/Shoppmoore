/* eslint-disable prettier/prettier */
import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth/auth.service/auth.service.service'; // 

/*
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { userId: string; email: string; role: string }) {
    console.log('JWT Payload:', payload);
  
    const user = await this.authService.getUserById(payload.userId);
  
    if (!user) {
      console.log('User not found in AuthService.getUserById');
      throw new UnauthorizedException('User not found');
    }
  
    console.log('User authenticated:', user);
    return user;
  }
  
}
*/

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { userId: string; email: string; role: string }) {
    const user = await this.authService.getUserById(payload.userId);
  
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
  
    //If user is a buyer and not verified, block login
    if (user.role === 'buyer' && !user.isVerified) {
      throw new UnauthorizedException('Please verify your email to continue');
    }
  
    return user;
  }
  

}
