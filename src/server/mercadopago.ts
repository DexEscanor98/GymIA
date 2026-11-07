import { db } from '@/lib/db';

type MpSubscription = {
  id: string;
  status: string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
};

type MpInvoice = {
  id: number | string;
  transaction_amount: number | string;
  currency_id: string;
  summarized?: string;
  status?: string;
  payment?: { id?: number | string; status?: string };
};

type MpInvoiceSearch = { results?: MpInvoice[] };

/** Reconcile only after Mercado Pago confirms both the subscription and its first payment. */
export async function reconcilePreapproval(tenantId: string, preapprovalId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return 'unavailable' as const;

  const local = await db.saasSubscription.findFirst({
    where: { tenantId, mpPreapprovalId: preapprovalId },
  });
  if (!local) return 'not_found' as const;

  const headers = { Authorization: `Bearer ${token}` };
  const subscriptionResponse = await fetch(
    `https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`,
    { headers, cache: 'no-store' },
  );
  if (!subscriptionResponse.ok) return 'unavailable' as const;
  const remote = (await subscriptionResponse.json()) as MpSubscription;
  if (
    remote.id !== preapprovalId ||
    remote.external_reference !== local.externalReference ||
    remote.auto_recurring?.currency_id !== 'MXN' ||
    Math.round(Number(remote.auto_recurring?.transaction_amount) * 100) !== local.amountCents
  )
    return 'unavailable' as const;

  if (['cancelled', 'canceled'].includes(remote.status)) {
    await db.saasSubscription.update({ where: { id: local.id }, data: { status: 'CANCELLED' } });
    return 'cancelled' as const;
  }
  if (remote.status === 'paused') {
    await db.saasSubscription.update({ where: { id: local.id }, data: { status: 'PAUSED' } });
    return 'paused' as const;
  }
  if (remote.status !== 'authorized') return 'pending' as const;

  const invoicesResponse = await fetch(
    `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`,
    { headers, cache: 'no-store' },
  );
  if (!invoicesResponse.ok) return 'unavailable' as const;
  const invoices = ((await invoicesResponse.json()) as MpInvoiceSearch).results || [];
  const invoice = invoices.find(
    (item) => (item.payment?.status || item.summarized || item.status) === 'approved',
  );
  if (!invoice) return 'pending' as const;

  const amountCents = Math.round(Number(invoice.transaction_amount) * 100);
  if (invoice.currency_id !== 'MXN' || amountCents !== local.amountCents)
    return 'unavailable' as const;

  const approvedAt = new Date();
  const periodEnd = remote.next_payment_date
    ? new Date(remote.next_payment_date)
    : new Date(new Date().setMonth(new Date().getMonth() + 1));
  const providerPaymentId = String(invoice.payment?.id || invoice.id);

  await db.$transaction(async (tx) => {
    await tx.saasPayment.upsert({
      where: { providerPaymentId },
      create: {
        subscriptionId: local.id,
        providerPaymentId,
        amountCents,
        status: 'approved',
        approvedAt,
      },
      update: { status: 'approved', approvedAt },
    });
    await tx.saasSubscription.update({
      where: { id: local.id },
      data: { status: 'ACTIVE', currentPeriodEnd: periodEnd },
    });
    await tx.tenant.update({
      where: { id: local.tenantId },
      data: { saasPlan: local.plan, subscriptionExpiresAt: periodEnd },
    });
  });
  return 'active' as const;
}
