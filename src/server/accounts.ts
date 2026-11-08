import { AppError } from '@/lib/domain';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { randomBytes } from 'node:crypto';

type ProvisionUserInput = {
  name: string;
  email: string;
};

export async function provisionUser({ name, email }: ProvisionUserInput) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) return existing;

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: normalized,
        name: name.trim(),
        password: randomBytes(36).toString('base64url'),
      },
    });
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    await auth.api.requestPasswordReset({
      body: { email: normalized, redirectTo: `${baseUrl}/reset-password` },
    });
    return db.user.findUniqueOrThrow({ where: { id: result.user.id } });
  } catch (error) {
    if (error instanceof Error) throw new AppError('No se pudo crear la cuenta. Revisa el correo.');
    throw error;
  }
}
