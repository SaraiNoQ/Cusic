import { HttpStatus, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { authError } from '../auth.errors';

@Injectable()
export class MailerService {
  async sendVerificationCode(email: string, code: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM;

    if (!host || !user || !pass || !from) {
      throw authError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_SMTP_NOT_CONFIGURED',
        'Email verification service is not configured',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your Cusic login code',
      text: `Your Cusic login code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Cusic login code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  }
}
