import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { json } from '@/server/http';

type MpSubscription = {
  id: string;
  status: string;
  external_reference?: string;
  next_payment_date?: string;
};

type MpAuthorizedPayment = {
  id: string;
  preapproval_id?: string;
  status: string;
  summarized?: string;
  transaction_amount: number | string;
  currency_id: string;
  last_modified?: string;
  payment?: { id: string | number; status: string };
};

function validSignature(signature: string, requestId: string, dataId: string, secret: string) {
  const values = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, value] = part.trim().split('=');
      return [key, value];
    }),
  );
  if (!values.ts || !values.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${values.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  let received: Buffer;
  try {
    received = Buffer.from(values.v1, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function mpGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Mercado Pago devolvió ${response.status}.`);
  return (await response.json()) as T;
}

function nextMonth(from: Date) {
  const result = new Date(from);
  result.setMonth(result.getMonth() + 1);
  return result;
}

export async function POST(request: Request) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!secret || !token) return json({ error: 'Webhook no configurado.' }, 503);

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    data?: { id?: string | number };
  };
  const dataId = String(url.searchParams.get('data.id') || body.data?.id || '');
  const eventType = url.searchParams.get('type') || body.type || '';
  const signature = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  if (!dataId || !requestId || !validSignature(signature, requestId, dataId, secret))
    return json({ error: 'Firma de Mercado Pago inválida.' }, 401);

  try {
    if (eventType === 'subscription_preapproval') {
      const mpSubscription = await mpGet<MpSubscription>(
        `/preapproval/${encodeURIComponent(dataId)}`,
        token,
      );
      if (!mpSubscription.external_reference) return json({ received: true });
      const local = await db.saasSubscription.findUnique({
        where: { externalReference: mpSubscription.external_reference },
      });
      if (!local) return json({ received: true });
      const status = ['cancelled', 'canceled'].includes(mpSubscription.status)
        ? 'CANCELLED'
        : mpSubscription.status === 'paused'
          ? 'PAUSED'
          : local.status;
      await db.saasSubscription.update({
        where: { id: local.id },
        data: {
          mpPreapprovalId: mpSubscription.id,
          status,
          ...(mpSubscription.next_payment_date
            ? { currentPeriodEnd: new Date(mpSubscription.next_payment_date) }
            : {}),
        },
      });
      return json({ received: true });
    }

    if (eventType !== 'subscription_authorized_payment') return json({ received: true });
    const payment = await mpGet<MpAuthorizedPayment>(
      `/authorized_payments/${encodeURIComponent(dataId)}`,
      token,
    );
    if (!payment.preapproval_id) return json({ received: true });
    const local = await db.saasSubscription.findUnique({
      where: { mpPreapprovalId: payment.preapproval_id },
      include: { tenant: true },
    });
    if (!local || local.status === 'CANCELLED') return json({ received: true });
    const amountCents = Math.round(Number(payment.transaction_amount) * 100);
    if (payment.currency_id !== 'MXN' || amountCents !== local.amountCents)
      return json({ error: 'El importe del pago no coincide con la suscripción.' }, 400);

    const paymentStatus = payment.payment?.status || payment.summarized || payment.status;
    const approvedAt = payment.last_modified ? new Date(payment.last_modified) : new Date();
    const mpSubscription = await mpGet<MpSubscription>(
      `/preapproval/${encodeURIComponent(payment.preapproval_id)}`,
      token,
    );
    const periodEnd = mpSubscription.next_payment_date
      ? new Date(mpSubscription.next_payment_date)
      : nextMonth(approvedAt);

    await db.$transaction(async (tx) => {
      await tx.saasPayment.upsert({
        where: { providerPaymentId: String(payment.id) },
        create: {
          subscriptionId: local.id,
          providerPaymentId: String(payment.id),
          amountCents,
          status: paymentStatus,
          approvedAt: paymentStatus === 'approved' ? approvedAt : null,
        },
        update: {
          status: paymentStatus,
          ...(paymentStatus === 'approved' ? { approvedAt } : {}),
        },
      });

      if (paymentStatus === 'approved') {
        await tx.saasSubscription.update({
          where: { id: local.id },
          data: { status: 'ACTIVE', currentPeriodEnd: periodEnd },
        });
        await tx.tenant.update({
          where: { id: local.tenantId },
          data: { saasPlan: local.plan, subscriptionExpiresAt: periodEnd },
        });
      } else if (paymentStatus === 'rejected') {
        await tx.saasSubscription.update({
          where: { id: local.id },
          data: { status: 'PAST_DUE' },
        });
      }
    });
    return json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error);
    return json({ error: 'No se pudo procesar la notificación.' }, 500);
  }
}
