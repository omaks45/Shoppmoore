/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class NotificationService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Set API Key
  }

  /** Send email via SendGrid */
  async sendEmail(to: string, subject: string, text: string, html?: string) {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL, // Verified sender email
      subject,
      text,
      html,
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error('SendGrid Error:', error.response?.body || error);
      throw new Error('Failed to send email');
    }
  }

  /** Send verification email */
  async sendVerificationEmail(email: string, verificationCode: string) {
    const subject = 'Verify Your Email';
    const html = `<p>Use this code to verify your account: <b>${verificationCode}</b></p>`;
    await this.sendEmail(email, subject, '', html);
  }

  /** Send admin creation notification */
  async sendAdminCreationEmail(email: string) {
    const subject = 'Admin Account Created';
    const html = `<p>Your admin account has been successfully created.</p>`;
    await this.sendEmail(email, subject, '', html);
  }
}
