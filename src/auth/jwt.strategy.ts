/* eslint-disable prettier/prettier */
import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth/auth.service/auth.service.service';
import { ConfigService } from '@nestjs/config';

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

  async validate(payload: any) {
    const user = await this.authService.getUserById(payload.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role === 'buyer' && !user.isVerified) {
      throw new UnauthorizedException('Please verify your email to continue');
    }
    // console.log('User from JWT strategy:', user);


    return {
      _id: user._id,
      email: user.email,
      role: user.role, //This is required
    }; // includes _id, role, etc.
  }
}
