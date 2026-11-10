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
  if (existing) {
    if (existing.gymInviteNeedsPasswordSetup) {
      await auth.api.requestPasswordReset({
        body: {
          email: normalized,
          redirectTo: `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/reset-password`,
        },
      });
      await db.user.update({
        where: { id: existing.id },
        data: { gymInviteNeedsPasswordSetup: false },
      });
    }
    if (!existing.emailVerified && !existing.phoneNumberVerified) {
      await db.user.update({
        where: { id: existing.id },
        data: { gymAccessPendingVerification: true },
      });
      await auth.api.sendVerificationEmail({
        body: { email: normalized, callbackURL: '/verify-account' },
      });
    }
    return existing;
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: normalized,
        name: name.trim(),
        password: randomBytes(36).toString('base64url'),
      },
    });
    await db.user.update({
      where: { id: result.user.id },
      data: { gymAccessPendingVerification: true, gymInviteNeedsPasswordSetup: true },
    });
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    await auth.api.requestPasswordReset({
      body: { email: normalized, redirectTo: `${baseUrl}/reset-password` },
    });
    await db.user.update({
      where: { id: result.user.id },
      data: { gymInviteNeedsPasswordSetup: false },
    });
    return db.user.findUniqueOrThrow({ where: { id: result.user.id } });
  } catch (error) {
    if (error instanceof Error) throw new AppError('No se pudo crear la cuenta. Revisa el correo.');
    throw error;
  }
}
