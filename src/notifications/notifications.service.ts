/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
      auth: {
        user: process.env.EMAIL_USER,     // your Gmail address
        pass: process.env.EMAIL_PASS,     // your App Password
      },
    });
  }

  /** Basic in-app notification logging */
  sendNotification({ message, userId }: { message: string; userId: string }) {
    console.log(`Notification sent to user ${userId}: ${message}`);
  }

  /** Generic Email Sender */
  async sendEmail(to: string, subject: string, text: string = '', html?: string) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error('Email Error:', error);
      throw new Error('Failed to send email');
    }
  }

  /** Send Verification Email */
  async sendVerificationEmail(email: string, verificationCode: string) {
    const subject = 'Verify Your Email';
    const html = `<p>Use this code to verify your account: <b>${verificationCode}</b></p>`;
    await this.sendEmail(email, subject, '', html);
  }

  /** Notify on Admin Account Creation */
  async sendAdminCreationEmail(email: string) {
    const subject = 'Admin Account Created';
    const html = `<p>Your admin account has been successfully created.</p>`;
    await this.sendEmail(email, subject, '', html);
  }

  /** Password Reset Email */
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

  /** Order Confirmation */
  async sendOrderConfirmationEmail(user: any, order: any) {
    const subject = 'Your Order Has Been Confirmed!';
    const html = `
      Hi ${user.firstName},<br><br>

      Thank you for shopping with us! Your order <strong>#${order._id}</strong> has been confirmed and is now being processed.<br><br>

      🛒 <strong>Order Summary:</strong><br>
      • Items: ${order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}<br>
      • Total Amount: $${order.totalAmount}<br>
      • Estimated Delivery: ${order.estimatedDeliveryDate || 'N/A'}<br><br>

      You can track your order anytime from your profile page.<br><br>

      Thank you for choosing Shoppmoore!<br><br>

      Best regards,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }

  /** Order Delivered */
  async sendOrderDeliveredEmail(user: any, order: any) {
    const subject = 'Your Order Has Been Delivered!';
    const html = `
      Hi ${user.firstName},<br><br>

      Great news! Your order <strong>#${order._id}</strong> has been successfully delivered.<br><br>

      🛍 <strong>Order Summary:</strong><br>
      • Items: ${order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}<br>
      • Delivered On: ${new Date().toLocaleDateString()}<br><br>

      We hope you love your purchase!<br>
      If you have any questions, feel free to reach out to our support team.<br><br>

      Cheers,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }

  /** Order Cancelled */
  async sendOrderCancelledEmail(user: any, order: any) {
    const subject = 'Your Order Has Been Cancelled';
    const html = `
      Hi ${user.firstName},<br><br>

      We're sorry to inform you that your order <strong>#${order._id}</strong> has been cancelled.<br><br>

      🛍 <strong>Order Summary:</strong><br>
      • Items: ${order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}<br>
      • Total Amount: $${order.totalAmount}<br><br>

      If this was a mistake or you’d like to reorder, you can visit your profile and try again.<br><br>

      Let us know if we can help with anything else.<br><br>

      Best regards,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }
}
