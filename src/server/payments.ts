import { ensure } from '@/lib/domain';

export function isSandboxPayments() {
  return process.env.GYMIA_PAYMENT_MODE === 'sandbox';
}

export function paymentPayerEmail(defaultEmail: string) {
  if (!isSandboxPayments()) return defaultEmail;
  const testEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim();
  ensure(testEmail, 'Configura el correo de la cuenta compradora de prueba de Mercado Pago.', 503);
  return testEmail;
}

export async function assertMercadoPagoSandboxAccount(accessToken: string) {
  ensure(isSandboxPayments(), 'El entorno de pagos no está configurado como sandbox.', 503);
  const expectedSellerId = process.env.MERCADOPAGO_TEST_SELLER_ID?.trim();
  ensure(expectedSellerId, 'Falta configurar el identificador de la cuenta vendedora de prueba.', 503);
  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const result = (await response.json().catch(() => ({}))) as { id?: string | number };
  ensure(
    response.ok && String(result.id ?? '') === expectedSellerId,
    'La credencial de Mercado Pago no corresponde a la cuenta vendedora de prueba configurada.',
    503,
  );
}
