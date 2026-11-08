import { z } from 'zod';
import { db } from '@/lib/db';
import { LEGAL_VERSIONS, legalCheckoutSchema } from '@/lib/legal-versions';
import { ensure } from '@/lib/domain';

export const legalAcceptanceSchema = z.object({
  contract: z.string(),
  terms: z.string(),
  privacy: z.string(),
  contractAccepted: z.literal(true),
  termsAccepted: z.literal(true),
  privacyAcknowledged: z.literal(true),
  recurringPayment: z.literal(true),
});

export type AcceptedLegalDocuments = z.infer<typeof legalAcceptanceSchema>;

export function billingCheckoutIsConfigured() {
  return (
    Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) &&
    Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim())
  );
}

export async function saveSubscriptionAcceptance(input: {
  accepted: AcceptedLegalDocuments;
  userId: string;
  tenantId?: string;
  subscriptionReference: string;
  flow: 'GYM_SAAS' | 'PERSONAL_PLUS';
  plan: string;
  amountCents: number;
}) {
  const contractVersion =
    input.flow === 'GYM_SAAS'
      ? LEGAL_VERSIONS.ownerContract.version
      : LEGAL_VERSIONS.personalContract.version;
  ensure(
    legalCheckoutSchema.contract(input.accepted.contract) &&
      input.accepted.contract === contractVersion,
    'La versión del contrato no coincide. Actualiza la página y vuelve a aceptar.',
    400,
  );
  ensure(
    legalCheckoutSchema.terms(input.accepted.terms),
    'La versión de los Términos y Condiciones no coincide. Actualiza la página.',
    400,
  );
  ensure(
    legalCheckoutSchema.privacy(input.accepted.privacy),
    'La versión del Aviso de Privacidad no coincide. Actualiza la página.',
    400,
  );
  ensure(input.accepted.recurringPayment, 'Debes autorizar el cobro recurrente.', 400);
  ensure(
    input.accepted.contractAccepted &&
      input.accepted.termsAccepted &&
      input.accepted.privacyAcknowledged,
    'Debes aceptar el contrato y los términos, y confirmar la lectura del aviso de privacidad.',
    400,
  );

  const items = [
    {
      type: contractVersion.startsWith('gymia-owner') ? 'OWNER_SAAS_CONTRACT' : 'PERSONAL_PLUS_CONTRACT',
      version: contractVersion,
      url: contractVersion.startsWith('gymia-owner')
        ? LEGAL_VERSIONS.ownerContract.url
        : LEGAL_VERSIONS.personalContract.url,
    },
    {
      type: LEGAL_VERSIONS.terms.type,
      version: LEGAL_VERSIONS.terms.version,
      url: LEGAL_VERSIONS.terms.url,
    },
    {
      type: LEGAL_VERSIONS.privacy.type,
      version: LEGAL_VERSIONS.privacy.version,
      url: LEGAL_VERSIONS.privacy.url,
    },
    {
      type: 'RECURRING_PAYMENT_CONSENT',
      version: 'consent-v1',
      url: LEGAL_VERSIONS.terms.url,
    },
  ];
  await db.legalAcceptance.createMany({
    data: items.map((item) => ({
      userId: input.userId,
      tenantId: input.tenantId ?? null,
      subscriptionReference: input.subscriptionReference,
      flow: input.flow,
      documentType: item.type,
      documentVersion: item.version,
      documentUrl: item.url,
      plan: input.plan,
      amountCents: input.amountCents,
      currency: 'MXN',
      billingInterval: 'MONTHLY',
      evidence: {
        checkboxChecked: true,
        acceptedByUserId: input.userId,
        acceptedAtUtc: new Date().toISOString(),
        plan: input.plan,
        amountCents: input.amountCents,
        currency: 'MXN',
        interval: 'MONTHLY',
      },
    })),
  });
}
