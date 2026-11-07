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
        body: JSON.stringify({ status: 'cancelled' }),
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      const providerError = (await response.json().catch(() => ({}))) as {
        message?: string;
        cause?: Array<{ code?: number | string; description?: string }>;
      };
      const causeCode = String(providerError.cause?.[0]?.code ?? '');
      const providerReason = (providerError.cause?.[0]?.description ?? providerError.message ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .slice(0, 200);
      let message = `Mercado Pago rechazó la cancelación (HTTP ${response.status}). La renovación sigue sin confirmarse como cancelada.`;

      if (response.status === 401 || response.status === 403) {
        message =
          'Mercado Pago rechazó las credenciales activas. Revisa que el Access Token corresponda al mismo entorno y cuenta que creó esta suscripción.';
      } else if (response.status === 404 || causeCode === '2000') {
        message =
          'Mercado Pago no encuentra esta suscripción con las credenciales activas. Si se creó con credenciales de prueba, debe cancelarse desde ese entorno; no se marcó como cancelada en Gymia.';
      } else if (response.status === 400) {
        message = `Mercado Pago rechazó la cancelación (HTTP 400)${providerReason ? `: ${providerReason}` : '.'} La suscripción no se marcó como cancelada en Gymia.`;
      }

      return json({ error: message, providerStatus: response.status }, 502);
    }
    await db.saasSubscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });
    return json({ cancelled: true, currentPeriodEnd: subscription.currentPeriodEnd });
  } catch (error) {
    return errorResponse(error);
  }
}
