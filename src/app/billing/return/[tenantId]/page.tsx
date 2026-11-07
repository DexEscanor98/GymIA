import Link from 'next/link';
import { reconcilePreapproval } from '@/server/mercadopago';

type BillingReturnProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ preapproval_id?: string | string[] }>;
};

export default async function BillingReturn({ params, searchParams }: BillingReturnProps) {
  const [{ tenantId }, query] = await Promise.all([params, searchParams]);
  const preapprovalId = Array.isArray(query.preapproval_id)
    ? query.preapproval_id[0]
    : query.preapproval_id;
  let result: Awaited<ReturnType<typeof reconcilePreapproval>> = 'pending';
  if (preapprovalId) {
    try {
      result = await reconcilePreapproval(tenantId, preapprovalId);
    } catch (error) {
      console.error('No se pudo confirmar el checkout de Mercado Pago:', error);
      result = 'unavailable';
    }
  }

  const copy = {
    active: {
      title: 'Tu suscripción está activa',
      message: 'Mercado Pago confirmó el pago y Gymia ya habilitó tu plan.',
    },
    pending: {
      title: 'Estamos confirmando tu pago',
      message:
        'El pago todavía aparece pendiente. Gymia activará el plan cuando Mercado Pago confirme el primer cobro.',
    },
    cancelled: {
      title: 'La suscripción fue cancelada',
      message: 'No se activó el plan. Puedes elegir otro plan desde Gymia.',
    },
    paused: {
      title: 'La suscripción está pausada',
      message:
        'Mercado Pago confirmó que la suscripción está pausada. Puedes revisar el estado desde tu cuenta.',
    },
    unavailable: {
      title: 'No pudimos verificar el pago todavía',
      message:
        'Vuelve a Gymia en unos minutos. La confirmación se comprueba de forma segura con Mercado Pago.',
    },
    not_found: {
      title: 'No encontramos esta solicitud de pago',
      message: 'Vuelve a Gymia y selecciona el plan para iniciar una nueva solicitud.',
    },
  }[result];

  return (
    <main className="onboarding">
      <section className="auth-card">
        <span className="eyebrow">MERCADO PAGO</span>
        <h1>{copy.title}</h1>
        <p>{copy.message}</p>
        <Link className="button primary" href="/">
          Volver a Gymia
        </Link>
      </section>
    </main>
  );
}
