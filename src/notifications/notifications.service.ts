/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE, // Gmail
      auth: {
        user: process.env.EMAIL_USER, // Gmail address
        pass: process.env.EMAIL_PASS, // App Password (not your Gmail password)
      },
    });
  }

  /** Send email via Gmail SMTP */
  async sendEmail(to: string, subject: string, text: string, html?: string) {
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender's Gmail
      to,
      subject,
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to}`);
    } catch (error) {
      console.error('❌ Email Error:', error);
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

  /** Send password reset email */
  async sendPasswordResetEmail(to: string, resetToken: string) {
    const subject = 'Password Reset OTP';
    const html = `
      <p>You requested a password reset. Use the OTP below to reset your password:</p>
      <h2 style="color: #333; text-align: center;">${resetToken}</h2>
      <p>This OTP is valid for only 5 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

    await this.sendEmail(to, subject, '', html);
}

}
