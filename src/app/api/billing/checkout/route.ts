import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { planInfo } from '@/lib/saas-plans';
import { ensure } from '@/lib/domain';
import { context } from '@/server/context';
import { errorResponse, json, readBody, sameOrigin } from '@/server/http';

const paidPlan = z.enum(['LITE', 'BASIC', 'STANDARD', 'PREMIUM']);

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({ tenantId: z.string().min(1), plan: paidPlan })
      .parse(await readBody(request));
    const c = await context(input.tenantId);
    ensure(c.role === 'OWNER', 'Solo el dueño puede cambiar el plan.', 403);

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    ensure(accessToken, 'Mercado Pago todavía no está configurado en el servidor.', 503);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
    ensure(baseUrl, 'Falta configurar la URL pública segura del sitio.', 503);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
    const details = planInfo(input.plan);
    const prior = await db.saasSubscription.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { status: 'PENDING' },
          { status: 'PAST_DUE' },
          { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    ensure(
      prior?.status !== 'ACTIVE' || Boolean(prior.mpPreapprovalId),
      'No se encontró la suscripción de Mercado Pago que se debe reemplazar. Contacta a soporte.',
      409,
    );
    ensure(
      !prior ||
        (prior.status === 'ACTIVE' && prior.plan !== input.plan) ||
        (['PENDING', 'PAST_DUE'].includes(prior.status) && prior.plan === input.plan),
      prior?.status === 'ACTIVE'
        ? `Ya tienes activo el plan ${details.name}.`
        : 'Ya hay un pago pendiente. Continúa ese pago o cancélalo antes de elegir otro plan.',
      409,
    );
    if (prior?.checkoutUrl) return json({ initPoint: prior.checkoutUrl });

    const externalReference = randomUUID();
    const subscription = await db.saasSubscription.create({
      data: {
        tenantId: tenant.id,
        plan: input.plan,
        amountCents: details.priceCents,
        externalReference,
      },
    });
    const origin = new URL(baseUrl).origin;
    const owner = await db.access.findFirstOrThrow({
      where: { tenantId: tenant.id, userId: c.userId, role: 'OWNER' },
      include: { user: { select: { email: true } } },
    });
    const payerEmail =
      process.env.NODE_ENV !== 'production'
        ? process.env.MERCADOPAGO_TEST_PAYER_EMAIL || owner.user.email
        : owner.user.email;
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': externalReference,
      },
      body: JSON.stringify({
        reason: `Gymia ${details.name} - ${tenant.name}`,
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: details.priceCents / 100,
          currency_id: 'MXN',
        },
        back_url: `${origin}/billing/return/${encodeURIComponent(tenant.id)}`,
        status: 'pending',
      }),
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      init_point?: string;
    };
    if (!response.ok || !data.id || !data.init_point) {
      await db.saasSubscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED' },
      });
      return json({ error: 'Mercado Pago no pudo iniciar el checkout. Intenta de nuevo.' }, 502);
    }

    // Create the new pending checkout before canceling the old recurring charge. This preserves
    // the current subscription if Mercado Pago cannot create a checkout for the selected plan.
    if (prior?.status === 'ACTIVE' && prior.mpPreapprovalId) {
      const cancelResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(prior.mpPreapprovalId)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
          cache: 'no-store',
        },
      );
      if (!cancelResponse.ok) {
        await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(data.id)}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
          cache: 'no-store',
        }).catch(() => undefined);
        await db.saasSubscription.update({
          where: { id: subscription.id },
          data: {
            mpPreapprovalId: data.id,
            checkoutUrl: data.init_point,
            status: 'CANCELLED',
          },
        });
        return json(
          { error: 'No se pudo cancelar la renovación actual. El plan no se cambió.' },
          502,
        );
      }
      await db.saasSubscription.update({
        where: { id: prior.id },
        data: { status: 'CANCELLED' },
      });
    }
    await db.saasSubscription.update({
      where: { id: subscription.id },
      data: { mpPreapprovalId: data.id, checkoutUrl: data.init_point },
    });
    return json({ initPoint: data.init_point });
  } catch (error) {
    return errorResponse(error);
  }
}
