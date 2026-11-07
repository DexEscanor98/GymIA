import Link from 'next/link';

export default function BillingReturn() {
  return (
    <main className="onboarding">
      <section className="auth-card">
        <span className="eyebrow">MERCADO PAGO</span>
        <h1>Estamos confirmando tu pago</h1>
        <p>
          Gymia activa el plan cuando recibe la confirmación segura de Mercado Pago. La suscripción
          recurrente solo se habilita después de aprobar el primer pago.
        </p>
        <Link className="button primary" href="/">
          Volver a Gymia
        </Link>
      </section>
    </main>
  );
}
