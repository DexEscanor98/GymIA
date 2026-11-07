import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';
import { errorResponse, json, sameOrigin } from '@/server/http';
type Remote = {
  id: string;
  status: string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { currency_id?: string; transaction_amount?: number };
};
type Payment = {
  id: string | number;
  transaction_amount: number | string;
  currency_id: string;
  status?: string;
  summarized?: string;
  payment?: { id?: string | number; status?: string };
};
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await auth.api.getSession({ headers: await headers() });
    ensure(session, 'Inicia sesión para continuar.', 401);
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    ensure(token, 'Mercado Pago no está configurado.', 503);
    const profile = await db.athleteProfile.findUnique({ where: { userId: session.user.id } });
    ensure(profile, 'Perfil personal no encontrado.', 404);
    const local = await db.athleteSubscription.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    ensure(local, 'No hay pago por verificar.', 404);
    if (!local.mpPreapprovalId) return json({ status: 'PENDING' });
    const headersMp = { Authorization: `Bearer ${token}` };
    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(local.mpPreapprovalId)}`,
      { headers: headersMp, cache: 'no-store' },
    );
    if (!response.ok) return json({ status: 'PENDING' });
    const remote = (await response.json()) as Remote;
    if (
      remote.id !== local.mpPreapprovalId ||
      remote.external_reference !== local.externalReference ||
      remote.auto_recurring?.currency_id !== 'MXN' ||
      Math.round(Number(remote.auto_recurring.transaction_amount) * 100) !== local.amountCents
    )
      return json({ error: 'No se pudo validar el pago contra la suscripción.' }, 409);
    if (['cancelled', 'canceled'].includes(remote.status)) {
      await db.athleteSubscription.update({
        where: { id: local.id },
        data: { status: 'CANCELLED' },
      });
      if (!local.currentPeriodEnd || local.currentPeriodEnd <= new Date())
        await db.athleteProfile.update({
          where: { id: profile.id },
          data: { personalPlan: 'FREE' },
        });
      return json({ status: 'CANCELLED' });
    }
    const invoicesResponse = await fetch(
      `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${encodeURIComponent(local.mpPreapprovalId)}`,
      { headers: headersMp, cache: 'no-store' },
    );
    if (!invoicesResponse.ok) return json({ status: 'PENDING' });
    const invoices = ((await invoicesResponse.json()) as { results?: Payment[] }).results || [];
    const invoice = invoices.find(
      (p) => (p.payment?.status || p.summarized || p.status) === 'approved',
    );
    if (!invoice) return json({ status: 'PENDING' });
    const amountCents = Math.round(Number(invoice.transaction_amount) * 100);
    ensure(
      invoice.currency_id === 'MXN' && amountCents === local.amountCents,
      'El importe confirmado no coincide.',
      409,
    );
    const paymentId = String(invoice.payment?.id || invoice.id);
    const now = new Date();
    const periodEnd = remote.next_payment_date
      ? new Date(remote.next_payment_date)
      : new Date(new Date().setMonth(new Date().getMonth() + 1));
    await db.$transaction(async (tx) => {
      await tx.athletePayment.upsert({
        where: { providerPaymentId: paymentId },
        create: {
          subscriptionId: local.id,
          providerPaymentId: paymentId,
          amountCents,
          status: 'approved',
          approvedAt: now,
        },
        update: { status: 'approved', approvedAt: now },
      });
      await tx.athleteSubscription.update({
        where: { id: local.id },
        data: { status: 'ACTIVE', currentPeriodEnd: periodEnd },
      });
      await tx.athleteProfile.update({
        where: { id: profile.id },
        data: { personalPlan: 'COACH' },
      });
    });
    return json({ status: 'ACTIVE' });
  } catch (error) {
    return errorResponse(error);
  }
}
