import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';
import { errorResponse, json, readBody, sameOrigin } from '@/server/http';

async function reserveSms(userId: string) {
  const key = `gymia-phone-otp:${userId}`;
  const timestamp = Date.now();
  const now = BigInt(timestamp);
  const hourAgo = now - 3_600_000n;
  const minuteAgo = now - 60_000n;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "lastRequest")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."lastRequest" < ${hourAgo} THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "lastRequest" = ${now}
    WHERE "RateLimit"."lastRequest" <= ${minuteAgo}
    RETURNING "count"
  `;
  ensure(rows.length > 0, 'Espera un minuto antes de pedir otro código.', 429);
  ensure((rows[0]?.count ?? 1) <= 5, 'Alcanzaste el límite de códigos. Intenta de nuevo en una hora.', 429);
}

async function twilio(path: string, params: URLSearchParams) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  ensure(sid && token && service, 'La verificación por SMS aún no está configurada.', 503);
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as { status?: string };
  ensure(response.ok, 'Twilio no pudo enviar el código. Verifica el número y la configuración de SMS.', 502);
  return data;
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = z.object({ phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/) }).parse(await readBody(request));
    const session = await auth.api.getSession({ headers: await headers() });
    ensure(session, 'Inicia sesión para verificar tu teléfono.', 401);
    const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
    ensure(!user.phoneNumberVerified, 'Este teléfono ya fue verificado.', 409);

    await reserveSms(user.id);
    await db.user.update({ where: { id: user.id }, data: { pendingPhoneNumber: input.phoneNumber } });
    try {
      const params = new URLSearchParams({ To: input.phoneNumber, Channel: 'sms' });
      await twilio('Verifications', params);
    } catch (error) {
      await db.user.update({ where: { id: user.id }, data: { pendingPhoneNumber: null } });
      throw error;
    }
    return json({ sent: true, phoneNumber: `${input.phoneNumber.slice(0, 4)}••••${input.phoneNumber.slice(-2)}` });
  } catch (error) {
    return errorResponse(error);
  }
}
