import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';

export async function requireVerifiedContacts(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      emailVerified: true,
      phoneNumber: true,
      phoneNumberVerified: true,
      gymAccessPendingVerification: true,
    },
  });
  ensure(
    user &&
      (user.emailVerified ||
        (user.phoneNumber && user.phoneNumberVerified) ||
        user.gymAccessPendingVerification),
    'Verifica tu correo electrónico o tu número de teléfono para continuar.',
    403,
  );
}
