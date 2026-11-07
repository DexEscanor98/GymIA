import 'dotenv/config';
import { db } from '../src/lib/db';
import { formatInTimeZone } from 'date-fns-tz';
import webpush from 'web-push';

const pushEnabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@gymia.app',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

let created = 0;
let delivered = 0;
for (const tenant of await db.tenant.findMany()) {
  const day = formatInTimeZone(new Date(), tenant.timezone, 'yyyy-MM-dd');
  const [year, month, date] = day.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1, date + 3)).toISOString().slice(0, 10);
  const memberships = await db.membership.findMany({
    where: { tenantId: tenant.id, status: 'ACTIVE', paid: true, endsAt: { gt: new Date() } },
    include: { member: true },
  });
  for (const m of memberships) {
    if (formatInTimeZone(m.endsAt, tenant.timezone, 'yyyy-MM-dd') !== target) continue;
    // Avoid obsolete notices when a renewal already covers the expiry.
    const renewal = memberships.some(
      (other) =>
        other.memberId === m.memberId &&
        other.id !== m.id &&
        other.startsAt <= m.endsAt &&
        other.endsAt > m.endsAt,
    );
    if (renewal) continue;
    const key = `expiry:${m.id}:${m.endsAt.toISOString()}`;
    const existing = await db.notification.findUnique({ where: { dedupeKey: key } });
    const notice = await db.notification.upsert({
      where: { dedupeKey: key },
      update: {},
      create: {
        tenantId: tenant.id,
        memberId: m.memberId,
        kind: 'MEMBERSHIP_EXPIRY',
        message: `Tu membresía ${m.planName} vence el ${target}. Acércate a recepción para renovarla.`,
        dedupeKey: key,
      },
    });
    if (!existing) created++;
    if (!pushEnabled || !m.member.userId || notice.pushSentAt) continue;
    const subscriptions = await db.pushSubscription.findMany({
      where: { tenantId: tenant.id, userId: m.member.userId },
    });
    let deliveredForNotice = false;
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              title: `${tenant.name}: membresía por vencer`,
              body: `Tu membresía ${m.planName} vence el ${target}. Acércate a recepción para renovarla.`,
              url: '/',
              tag: `membership:${m.id}`,
            }),
            { TTL: 60 * 60 * 24 },
          );
          deliveredForNotice = true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410)
            await db.pushSubscription.delete({ where: { id: subscription.id } });
          else console.error(`Push falló para ${subscription.id}:`, error);
        }
      }),
    );
    if (deliveredForNotice) {
      await db.notification.update({ where: { id: notice.id }, data: { pushSentAt: new Date() } });
      delivered++;
    }
  }
}
console.log(`Avisos revisados: ${created}; notificaciones push enviadas: ${delivered}.`);
await db.$disconnect();
