/* eslint-disable prettier/prettier */
import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth/auth.service/auth.service.service';
import { ConfigService } from '@nestjs/config';

interface JwtValidatedUser {
  _id: string;
  email: string;
  role: 'admin' | 'buyer';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<JwtValidatedUser> {
    //console.log('🔥 JwtStrategy.validate() fired');
    //console.log('🪪 Payload:', payload);
  
    const user = await this.authService.getUserById(payload.userId);
    //console.log('👤 User fetched:', user?.email);
  
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.isAdmin && !user.isVerified) {
      throw new UnauthorizedException('Please verify your email');
    }
  
    return {
      _id: user._id.toString(),
      email: user.email,
      role: user.isAdmin ? 'admin' : 'buyer',
    };
  }
  
}
