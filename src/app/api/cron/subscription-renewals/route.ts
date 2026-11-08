import { timingSafeEqual } from 'node:crypto';
import { json } from '@/server/http';
import { sendSubscriptionRenewalNotices } from '@/server/renewal-notices';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: 'No autorizado.' }, 401);
  try {
    return json(await sendSubscriptionRenewalNotices());
  } catch (error) {
    console.error('Falló la generación de avisos de renovación:', error);
    return json({ error: 'No se pudieron generar los avisos de renovación.' }, 500);
  }
}
