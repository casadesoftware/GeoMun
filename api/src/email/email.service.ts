import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private from: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.RESEND_FROM_EMAIL || 'noreply@pixelmapas.online';
  }

  async sendVerificationEmail(to: string, name: string, token: string) {
    const verifyUrl = `${process.env.APP_URL || 'https://pixelmapas.online'}/api/auth/verify/${token}`;

    await this.resend.emails.send({
      from: `GeoMun <${this.from}>`,
      to,
      subject: 'Verifica tu cuenta en Mapas by Pixel',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Hola ${name}!</h2>
          <p>Gracias por registrarte en GeoMun. Haz clic en el siguiente botón para verificar tu cuenta:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Verificar mi cuenta
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Este enlace expira en 24 horas.</p>
          <p style="color: #666; font-size: 14px;">Si no creaste esta cuenta, ignora este correo.</p>
        </div>
      `,
    });
  }
}