import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';
import { errorResponse, json, readBody, sameOrigin } from '@/server/http';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { code } = z.object({ code: z.string().regex(/^\d{4,10}$/) }).parse(await readBody(request));
    const session = await auth.api.getSession({ headers: await headers() });
    ensure(session, 'Inicia sesión para verificar tu teléfono.', 401);
    const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
    ensure(!user.phoneNumberVerified, 'Este teléfono ya fue verificado.', 409);
    ensure(user.pendingPhoneNumber, 'Solicita un código antes de verificar el teléfono.', 409);

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const service = process.env.TWILIO_VERIFY_SERVICE_SID;
    ensure(sid && token && service, 'La verificación por SMS aún no está configurada.', 503);
    const body = new URLSearchParams({ To: user.pendingPhoneNumber, Code: code });
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${service}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        cache: 'no-store',
      },
    );
    const result = (await response.json().catch(() => ({}))) as { status?: string };
    ensure(response.ok, 'El código no se pudo validar. Solicita otro e inténtalo nuevamente.', 400);
    ensure(result.status === 'approved', 'El código es incorrecto o ya venció.', 400);
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneNumber: user.pendingPhoneNumber,
        phoneNumberVerified: true,
        pendingPhoneNumber: null,
      },
    });
    return json({ verified: true });
  } catch (error) {
    return errorResponse(error);
  }
}
