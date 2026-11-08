import webpush from 'web-push';
import { db } from '@/lib/db';
import { planInfo } from '@/lib/saas-plans';

const DAY = 86_400_000;

function inFiveDayWindow(periodEnd: Date, now: Date) {
  const difference = periodEnd.getTime() - now.getTime();
  return difference > 5 * DAY && difference <= 6 * DAY;
}

export async function sendSubscriptionRenewalNotices(now = new Date()) {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);
  if (pushEnabled)
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:bytecservissoluciones@gmail.com',
      vapidPublicKey!,
      vapidPrivateKey!,
    );

  let noticesCreated = 0;
  let pushesSent = 0;
  const subscriptions = await db.saasSubscription.findMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date(now.getTime() + 5 * DAY), lte: new Date(now.getTime() + 6 * DAY) } },
    include: { tenant: { include: { accesses: { where: { role: 'OWNER', active: true } } } } },
  });

  for (const subscription of subscriptions) {
    if (!subscription.currentPeriodEnd) continue;
    const end = subscription.currentPeriodEnd;
    if (!inFiveDayWindow(end, now)) continue;
    const date = end.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });
    for (const owner of subscription.tenant.accesses) {
      const dedupeKey = `saas-renewal:${subscription.id}:${end.toISOString()}:${owner.userId}`;
      const existing = await db.appNotification.findUnique({ where: { dedupeKey } });
      const notice = await db.appNotification.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          userId: owner.userId,
          tenantId: subscription.tenantId,
          kind: 'SAAS_RENEWAL',
          dedupeKey,
          message: `Tu plan Gymia ${planInfo(subscription.plan).name} se renovará el ${date}. Puedes revisar o cancelar la renovación desde Configuración.`,
        },
      });
      if (!existing) noticesCreated++;
      if (!pushEnabled || notice.pushSentAt) continue;
      const devices = await db.pushSubscription.findMany({
        where: { tenantId: subscription.tenantId, userId: owner.userId },
      });
      let delivered = false;
      await Promise.all(devices.map(async (device) => {
        try {
          await webpush.sendNotification(
            { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
            JSON.stringify({
              title: 'Renovación de Gymia próxima',
              body: notice.message,
              url: '/',
              tag: dedupeKey,
            }),
            { TTL: 60 * 60 * 24 },
          );
          delivered = true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410)
            await db.pushSubscription.delete({ where: { id: device.id } });
          else console.error(`No se pudo enviar push de renovación (${device.id}):`, error);
        }
      }));
      if (delivered) {
        await db.appNotification.update({ where: { id: notice.id }, data: { pushSentAt: now } });
        pushesSent++;
      }
    }
  }

  const personalSubscriptions = await db.athleteSubscription.findMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date(now.getTime() + 5 * DAY), lte: new Date(now.getTime() + 6 * DAY) } },
    include: { profile: { select: { userId: true } } },
  });
  for (const subscription of personalSubscriptions) {
    if (!subscription.currentPeriodEnd) continue;
    const date = subscription.currentPeriodEnd.toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'long',
    });
    const dedupeKey = `personal-renewal:${subscription.id}:${subscription.currentPeriodEnd.toISOString()}`;
    const existing = await db.appNotification.findUnique({ where: { dedupeKey } });
    await db.appNotification.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        userId: subscription.profile.userId,
        kind: 'PERSONAL_RENEWAL',
        dedupeKey,
        message: `Tu plan Gymia Plus se renovará el ${date}. Puedes revisar o cancelar la renovación desde tu espacio personal.`,
      },
    });
    if (!existing) noticesCreated++;
  }
  return { noticesCreated, pushesSent };
}
