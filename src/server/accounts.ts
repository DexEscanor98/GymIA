import { AppError, ensure } from '@/lib/domain';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

type ProvisionUserInput = {
  name: string;
  email: string;
  password?: string;
};

export async function provisionUser({ name, email, password }: ProvisionUserInput) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) return existing;

  ensure(password && password.length >= 12, 'Escribe una contraseña de al menos 12 caracteres.');

  try {
    const result = await auth.api.signUpEmail({
      body: { email: normalized, name: name.trim(), password },
    });
    return db.user.findUniqueOrThrow({ where: { id: result.user.id } });
  } catch (error) {
    if (error instanceof Error) throw new AppError('No se pudo crear la cuenta. Revisa el correo.');
    throw error;
  }
}
