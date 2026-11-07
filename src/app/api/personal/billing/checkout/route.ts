import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ensure } from '@/lib/domain';
import { errorResponse, json, sameOrigin } from '@/server/http';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await auth.api.getSession({ headers: await headers() });
    ensure(session, 'Inicia sesión para continuar.', 401);
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    ensure(token, 'Mercado Pago no está configurado.', 503);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || new URL(request.url).origin;
    const profile = await db.athleteProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        publicId: `GYM-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`,
      },
      update: {},
    });
    const now = new Date();
    const current = await db.athleteSubscription.findFirst({
      where: {
        profileId: profile.id,
        OR: [
          { status: { in: ['PENDING', 'PAST_DUE'] } },
          { status: { in: ['ACTIVE', 'CANCELLED'] }, currentPeriodEnd: { gt: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    ensure(
      current?.status !== 'ACTIVE' || Boolean(current.mpPreapprovalId),
      'Ya tienes Gymia Plus activo.',
      409,
    );
    if (current?.status === 'PENDING' && current.checkoutUrl)
      return json({ initPoint: current.checkoutUrl });
    ensure(
      !current || !['ACTIVE', 'CANCELLED'].includes(current.status),
      current?.status === 'CANCELLED'
        ? 'Tu periodo pagado de Gymia Plus sigue vigente; podrás renovar cuando termine.'
        : 'Gymia Plus ya está activo.',
      409,
    );
    const externalReference = randomUUID();
    const subscription = await db.athleteSubscription.create({
      data: { profileId: profile.id, amountCents: 9900, externalReference },
    });
    const origin = new URL(baseUrl).origin;
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': externalReference,
      },
      body: JSON.stringify({
        reason: 'Gymia Plus personal',
        external_reference: externalReference,
        payer_email: session.user.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 99,
          currency_id: 'MXN',
        },
        back_url: `${origin}/personal?payment=return`,
        status: 'pending',
      }),
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      init_point?: string;
    };
    if (!response.ok || !payload.id || !payload.init_point) {
      await db.athleteSubscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED' },
      });
      return json({ error: 'Mercado Pago no pudo iniciar el pago. Intenta de nuevo.' }, 502);
    }
    await db.athleteSubscription.update({
      where: { id: subscription.id },
      data: { mpPreapprovalId: payload.id, checkoutUrl: payload.init_point },
    });
    return json({ initPoint: payload.init_point });
  } catch (error) {
    return errorResponse(error);
  }
}
