import { z } from 'zod';
import { db } from '@/lib/db';
import { context } from '@/server/context';
import { errorResponse, json, readBody, sameOrigin } from '@/server/http';
import { ensure } from '@/lib/domain';
import { planInfo } from '@/lib/saas-plans';

const schema = z.object({
  tenantId: z.string().min(1),
  endpoint: z.url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = z.string().min(1).parse(url.searchParams.get('tenantId'));
    const endpoint = z.url().max(2048).parse(url.searchParams.get('endpoint'));
    const c = await context(tenantId);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
    if (!planInfo(tenant.saasPlan).paidFeatures) return json({ subscribed: false });
    const subscription = await db.pushSubscription.findFirst({
      where: { tenantId: c.tenantId, userId: c.userId, endpoint },
      select: { id: true },
    });
    return json({ subscribed: Boolean(subscription) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = schema.parse(await readBody(request));
    const c = await context(input.tenantId);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
    ensure(
      planInfo(tenant.saasPlan).paidFeatures,
      'Las notificaciones están disponibles en planes de pago.',
      403,
    );
    await db.pushSubscription.upsert({
      where: {
        tenantId_userId_endpoint: {
          tenantId: c.tenantId,
          userId: c.userId,
          endpoint: input.endpoint,
        },
      },
      create: {
        tenantId: c.tenantId,
        userId: c.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
      update: { p256dh: input.keys.p256dh, auth: input.keys.auth },
    });
    return json({ subscribed: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({ tenantId: z.string().min(1), endpoint: z.url().max(2048) })
      .parse(await readBody(request));
    const c = await context(input.tenantId);
    await db.pushSubscription.deleteMany({
      where: { tenantId: c.tenantId, userId: c.userId, endpoint: input.endpoint },
    });
    return json({ subscribed: false });
  } catch (error) {
    return errorResponse(error);
  }
}
