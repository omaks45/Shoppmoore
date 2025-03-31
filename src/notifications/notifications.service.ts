/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  constructor(private configService: ConfigService) {
    sgMail.setApiKey(this.configService.get<string>('SENDGRID_API_KEY'));
  }

  async sendEmailVerification(email: string, verificationCode: string) {
    const msg = {
      to: email,
      from: this.configService.get<string>('SENDGRID_FROM_EMAIL'), // Your verified sender email
      subject: 'Verify Your Email',
      text: `Your verification code is: ${verificationCode}`,
      html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`,
    };

    await sgMail.send(msg);
  }
}
