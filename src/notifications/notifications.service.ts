/* eslint-disable prettier/prettier */
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { NotificationGateway } from '../notifications/notification.gateway';
import { credential } from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import admin from 'firebase-admin';

@Injectable()
export class NotificationService implements OnModuleInit {
  private transporter;

  constructor(private readonly notificationGateway: NotificationGateway) {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /** Initialize Firebase Admin SDK after app starts */
  onModuleInit() {
    if (!getApps().length) {
      admin.initializeApp({
        credential: credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('Firebase initialized');
    }
  }

  /** In-App notification (logging) */
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

  /** Notify Admin on New Account */
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

  /** Order Confirmation Email */
  async sendOrderConfirmationEmail(user: any, order: any) {
    const subject = 'Your Order Has Been Confirmed!';
    const html = `
      Hi ${user.firstName},<br><br>

      Thank you for shopping with us! Your order <strong>#${order._id}</strong> has been confirmed and is now being processed.<br><br>

      🛒 <strong>Order Summary:</strong><br>
      • Items: ${order.items.map((item: any) => `${item.productName} x${item.quantity}`).join(', ')}<br>
      • Total Amount: ₦${order.totalAmount}<br>
      • Estimated Delivery: ${order.estimatedDeliveryDate || 'N/A'}<br><br>

      You can track your order anytime from your profile page.<br><br>

      Thank you for choosing Shoppmoore!<br><br>

      Best regards,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }

  /** Order Delivered Email */
  async sendOrderDeliveredEmail(user: any, order: any) {
    const subject = 'Your Order Has Been Delivered!';
    const html = `
      Hi ${user.firstName},<br><br>

      Great news! Your order <strong>#${order._id}</strong> has been successfully delivered.<br><br>

      🛍 <strong>Order Summary:</strong><br>
      • Items: ${order.items.map((item: any) => `${item.productName} x${item.quantity}`).join(', ')}<br>
      • Delivered On: ${new Date().toLocaleDateString()}<br><br>

      We hope you love your purchase!<br>
      If you have any questions, feel free to reach out to our support team.<br><br>

      Cheers,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }

  /** Order Cancelled Email */
  async sendOrderCancelledEmail(user: any, order: any) {
    const subject = 'Your Order Has Been Cancelled';
    const html = `
      Hi ${user.firstName},<br><br>

      We're sorry to inform you that your order <strong>#${order._id}</strong> has been cancelled.<br><br>

      🛍 <strong>Order Summary:</strong><br>
      • Items: ${order.items.map((item: any) => `${item.productName} x${item.quantity}`).join(', ')}<br>
      • Total Amount: ₦${order.totalAmount}<br><br>

      If this was a mistake or you’d like to reorder, you can visit your profile and try again.<br><br>

      Let us know if we can help with anything else.<br><br>

      Best regards,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }

  /** Payment Confirmation Email (Wallet Top-up or Purchase) */
  async sendPaymentConfirmationEmail(user: any, paymentDetails: any) {
    const subject = 'Payment Confirmation - Wallet Transaction';
    const html = `
      Hi ${user.firstName},<br><br>

      🎉 Your payment was successful! Here are the transaction details:<br><br>

      💳 <strong>Transaction ID:</strong> ${paymentDetails.transactionId}<br>
      💰 <strong>Amount Paid:</strong> ₦${paymentDetails.amount}<br>
      🕒 <strong>Date:</strong> ${new Date(paymentDetails.timestamp).toLocaleString()}<br>
      💼 <strong>Payment Type:</strong> ${paymentDetails.type}<br><br>

      Your wallet has been updated accordingly.<br>
      You can view your transaction history in your profile.<br><br>

      Thanks for using Shoppmoore Wallet!<br><br>

      Best regards,<br>
      The Shoppmoore Team
    `;
    await this.sendEmail(user.email, subject, '', html);
  }

  /** New Review Notification (WebSocket + Firebase Push) */
  async notifyNewReview(review: any) {
    this.notificationGateway.sendNewReviewNotification(review);

    const payload = {
      notification: {
        title: 'New Review Posted',
        body: review.content.substring(0, 50) + '...',
      },
      data: {
        type: 'new_review',
        reviewId: review._id.toString(),
      },
      topic: 'admin_notifications',
    };

    try {
      await getMessaging().send(payload);
      console.log('Firebase Notification Sent Successfully');
    } catch (err) {
      console.error('Firebase Notification Error:', err);
    }
  }


    /** Review Updated Notification (WebSocket + Firebase Push) */
  async notifyReviewUpdated(review: any) {
    this.notificationGateway.sendReviewUpdatedNotification(review);

    const payload = {
      notification: {
        title: 'Review Updated',
        body: review.content.substring(0, 50) + '...',
      },
      data: {
        type: 'review_updated',
        reviewId: review._id.toString(),
      },
      topic: review.userId.toString(), // use userId as topic or customize per user
    };

    try {
      await getMessaging().send(payload);
      console.log('Firebase Review Update Notification Sent');
    } catch (err) {
      console.error('Firebase Review Update Error:', err);
    }
  }

  /** Review Deleted Notification (WebSocket + Firebase Push) */
  async notifyReviewDeleted(review: any) {
    this.notificationGateway.sendReviewDeletedNotification(review);

    const payload = {
      notification: {
        title: 'Review Deleted',
        body: `Your review for product ${review.productId} was deleted.`,
      },
      data: {
        type: 'review_deleted',
        reviewId: review._id.toString(),
      },
      topic: review.userId.toString(),
    };

    try {
      await getMessaging().send(payload);
      console.log('Firebase Review Deletion Notification Sent');
    } catch (err) {
      console.error('Firebase Review Deletion Error:', err);
    }
  }


  /** payment notification email */

  async sendPaymentSuccessEmail(user: { email: string; firstName: string }, order: any) {
    const subject = 'Your payment was successful!';
    const html = `
      <p>Hi ${user.firstName},</p>
      <p>Thank you for your payment. Your order <b>#${order._id}</b> has been successfully paid for.</p>
      <p>Order Summary:</p>
      <ul>
        ${order.items.map((item: any) => `<li>${item.quantity} x ${item.productName}</li>`).join('')}
      </ul>
      <p>Total: ₦${order.totalAmount}</p>
      <p>Estimated Delivery: ${order.estimatedDeliveryDate ?? 'N/A'}</p>
      <p>We’ll notify you once your order is shipped.</p>
      <p>Thanks,<br/>The Shoppmoore Team</p>
    `;
    await this.sendEmail(user.email, subject, '', html);
  }
  
}
