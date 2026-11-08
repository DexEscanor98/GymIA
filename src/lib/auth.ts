import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from './db';
import { sendTransactionalEmail } from '@/server/email';
import { createPublicId } from '@/lib/public-ids';
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  // Keep sign-in available so legacy accounts can reach the verification screen.
  // Product APIs and onboarding accept either verified email or verified phone.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: 'Crea tu contraseña de Gymia',
        text: `Se creó una cuenta para ti en Gymia. Abre este enlace para elegir tu contraseña: ${url}\n\nEl enlace vence en una hora. Si no esperabas esta invitación, ignora este mensaje.`,
        html: `<p>Se creó una cuenta para ti en Gymia.</p><p><a href="${escapeHtml(url)}">Crear mi contraseña</a></p><p>El enlace vence en una hora. Si no esperabas esta invitación, ignora este mensaje.</p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: 'Confirma tu correo para Gymia',
        text: `Confirma tu correo abriendo este enlace: ${url}\n\nEl enlace vence en una hora. Si no solicitaste la cuenta, ignora este mensaje.`,
        html: `<p>Confirma tu correo para continuar en Gymia.</p><p><a href="${escapeHtml(url)}">Verificar mi correo</a></p><p>El enlace vence en una hora. Si no solicitaste la cuenta, ignora este mensaje.</p>`,
      });
    },
  },
  user: {
    additionalFields: {
      phoneNumber: { type: 'string', required: false, input: true },
      phoneNumberVerified: { type: 'boolean', required: false, defaultValue: false, input: false },
      pendingPhoneNumber: { type: 'string', required: false, input: false },
      publicId: { type: 'string', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          return { data: { ...user, publicId: createPublicId('PER') } };
        },
      },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 40, storage: 'database' },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://127.0.0.1:3000']),
  ],
});
