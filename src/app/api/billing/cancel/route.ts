import { z } from 'zod';
import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';
import { context } from '@/server/context';
import { errorResponse, json, readBody, sameOrigin } from '@/server/http';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { tenantId } = z.object({ tenantId: z.string().min(1) }).parse(await readBody(request));
    const c = await context(tenantId);
    ensure(c.role === 'OWNER', 'Solo el dueño puede gestionar el plan.', 403);
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    ensure(token, 'Mercado Pago todavía no está configurado en el servidor.', 503);
    const subscription = await db.saasSubscription.findFirst({
      where: {
        tenantId: c.tenantId,
        status: { in: ['PENDING', 'ACTIVE', 'PAST_DUE'] },
        mpPreapprovalId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    ensure(subscription?.mpPreapprovalId, 'No hay una suscripción que se pueda cancelar.', 404);

    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(subscription.mpPreapprovalId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'canceled' }),
        cache: 'no-store',
      },
    );
    if (!response.ok) return json({ error: 'Mercado Pago no pudo cancelar la renovación.' }, 502);
    await db.saasSubscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });
    return json({ cancelled: true, currentPeriodEnd: subscription.currentPeriodEnd });
  } catch (error) {
    return errorResponse(error);
  }
}
