import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';
import { errorResponse, json, sameOrigin } from '@/server/http';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await auth.api.getSession({ headers: await headers() });
    ensure(session, 'Inicia sesión para continuar.', 401);
    const profile = await db.athleteProfile.findUnique({ where: { userId: session.user.id } });
    ensure(profile, 'Perfil personal no encontrado.', 404);
    const sub = await db.athleteSubscription.findFirst({
      where: { profileId: profile.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    ensure(sub, 'No tienes una suscripción activa.', 409);
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    ensure(token && sub.mpPreapprovalId, 'No se encontró la suscripción de Mercado Pago.', 503);
    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(sub.mpPreapprovalId)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
        cache: 'no-store',
      },
    );
    if (!response.ok)
      return json(
        { error: 'Mercado Pago no pudo cancelar la renovación. Intenta nuevamente.' },
        502,
      );
    await db.athleteSubscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
