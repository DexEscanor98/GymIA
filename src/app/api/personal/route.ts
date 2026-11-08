import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensure } from '@/lib/domain';
import { errorResponse, json, readBody, sameOrigin } from '@/server/http';
import { requireVerifiedContacts } from '@/server/verified-contacts';

const profileId = () => `GYM-${randomBytes(10).toString('hex').toUpperCase()}`;
async function ownedProfile() {
  const session = await auth.api.getSession({ headers: await headers() });
  ensure(session, 'Inicia sesión para continuar.', 401);
  await requireVerifiedContacts(session.user.id);
  const profile = await db.athleteProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, publicId: profileId() },
    update: {},
  });
  return { session, profile };
}

export async function GET() {
  try {
    const { session, profile } = await ownedProfile();
    if (profile.personalPlan === 'COACH') {
      const active = await db.athleteSubscription.findFirst({
        where: {
          profileId: profile.id,
          status: { in: ['ACTIVE', 'CANCELLED'] },
          currentPeriodEnd: { gt: new Date() },
        },
      });
      if (!active)
        await db.athleteProfile.update({
          where: { id: profile.id },
          data: { personalPlan: 'FREE' },
        });
    }
    const [notes, routines, workouts, meals, messages, requests, subscription, gymLinks, appNotifications] =
      await Promise.all([
        db.athleteNote.findMany({
          where: { profileId: profile.id },
          orderBy: { updatedAt: 'desc' },
          take: 30,
        }),
        db.athleteRoutine.findMany({
          where: { profileId: profile.id },
          orderBy: { updatedAt: 'desc' },
        }),
        db.athleteWorkout.findMany({
          where: { profileId: profile.id },
          orderBy: { startsAt: 'desc' },
          take: profile.personalPlan === 'COACH' ? 300 : 30,
        }),
        db.athleteMeal.findMany({
          where: {
            profileId: profile.id,
            eatenAt: {
              gte: new Date(Date.now() - (profile.personalPlan === 'COACH' ? 90 : 7) * 86400_000),
            },
          },
          orderBy: { eatenAt: 'desc' },
        }),
        db.coachMessage.findMany({
          where: { profileId: profile.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        db.nutritionistRequest.findMany({
          where: { profileId: profile.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        db.athleteSubscription.findFirst({
          where: { profileId: profile.id },
          orderBy: { createdAt: 'desc' },
        }),
        db.access.findMany({
          where: { userId: session.user.id, active: true },
          select: { role: true, tenant: { select: { id: true, name: true, slug: true } } },
        }),
        db.appNotification.findMany({
          where: { userId: session.user.id, tenantId: null, readAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
    const freshProfile =
      profile.personalPlan === 'COACH' &&
      (!subscription ||
        !['ACTIVE', 'CANCELLED'].includes(subscription.status) ||
        (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()))
        ? { ...profile, personalPlan: 'FREE' as const }
        : profile;
    return json({
      user: { name: session.user.name, email: session.user.email },
      profile: freshProfile,
      notes,
      routines,
      workouts,
      meals,
      messages,
      requests,
      subscription,
      gymLinks,
      appNotifications,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { profile } = await ownedProfile();
    const body = (await readBody(request)) as { action?: string; [key: string]: unknown };
    if (body.action === 'profile.update') {
      const optionalNumber = (min: number, max: number) =>
        z.preprocess(
          (v) => (v === '' || v == null ? null : Number(v)),
          z.number().min(min).max(max).nullable(),
        );
      const d = z
        .object({
          goal: z.string().trim().min(2).max(120),
          dietPlan: z.string().trim().max(5000),
          weightKg: optionalNumber(20, 400),
          heightCm: optionalNumber(80, 250),
          dailyCalories: z.coerce.number().int().min(500).max(10000),
          proteinGrams: z.coerce.number().int().min(0).max(1000),
          carbsGrams: z.coerce.number().int().min(0).max(1500),
          fatGrams: z.coerce.number().int().min(0).max(1000),
        })
        .parse(body);
      return json(await db.athleteProfile.update({ where: { id: profile.id }, data: d }));
    }
    if (body.action === 'note.save') {
      const d = z
        .object({
          id: z.string().optional(),
          title: z.string().trim().min(1).max(100),
          content: z.string().trim().min(1).max(5000),
        })
        .parse(body);
      return json(
        d.id
          ? await db.athleteNote.updateMany({
              where: { id: d.id, profileId: profile.id },
              data: { title: d.title, content: d.content },
            })
          : await db.athleteNote.create({
              data: { profileId: profile.id, title: d.title, content: d.content },
            }),
      );
    }
    if (body.action === 'routine.save') {
      const d = z
        .object({
          title: z.string().trim().min(2).max(100),
          details: z.string().trim().min(1).max(8000),
        })
        .parse(body);
      if (profile.personalPlan === 'FREE')
        ensure(
          (await db.athleteRoutine.count({ where: { profileId: profile.id } })) < 4,
          'El plan Gratis permite hasta 4 rutinas. Gymia Plus incluye rutinas ilimitadas.',
        );
      return json(await db.athleteRoutine.create({ data: { profileId: profile.id, ...d } }));
    }
    if (body.action === 'routine.delete') {
      const d = z.object({ id: z.string() }).parse(body);
      return json(
        await db.athleteRoutine.deleteMany({ where: { id: d.id, profileId: profile.id } }),
      );
    }
    if (body.action === 'workout.save') {
      const d = z
        .object({
          title: z.string().trim().min(2).max(100),
          startsAt: z.iso.datetime(),
          durationMinutes: z.coerce.number().int().min(10).max(360),
          notes: z.string().trim().max(1000).optional(),
        })
        .parse(body);
      const startsAt = new Date(d.startsAt);
      ensure(
        startsAt.getTime() >= Date.now() - 60_000 &&
          startsAt.getTime() < Date.now() + 366 * 86400_000,
        'Elige una fecha de entrenamiento válida dentro del próximo año.',
      );
      return json(
        await db.athleteWorkout.create({ data: { profileId: profile.id, ...d, startsAt } }),
      );
    }
    if (body.action === 'workout.complete') {
      const d = z.object({ id: z.string() }).parse(body);
      return json(
        await db.athleteWorkout.updateMany({
          where: { id: d.id, profileId: profile.id },
          data: { completedAt: new Date() },
        }),
      );
    }
    if (body.action === 'meal.save') {
      const d = z
        .object({
          mealName: z.string().trim().min(2).max(80),
          foods: z.string().trim().min(1).max(1000),
          calories: z.coerce.number().int().min(0).max(10000),
          proteinGrams: z.coerce.number().int().min(0).max(1000),
          carbsGrams: z.coerce.number().int().min(0).max(1500),
          fatGrams: z.coerce.number().int().min(0).max(1000),
        })
        .parse(body);
      return json(await db.athleteMeal.create({ data: { profileId: profile.id, ...d } }));
    }
    if (body.action === 'coach.ask') {
      const d = z.object({ question: z.string().trim().min(5).max(1000) }).parse(body);
      const answer = /lesi[oó]n|dolor|m[eé]dic|enferm|embaraz/i.test(d.question)
        ? 'No puedo valorar síntomas ni sustituir a un profesional de salud. Suspende la actividad si el dolor es intenso o repentino y consulta a un médico o fisioterapeuta. Puedo ayudarte a organizar tus hábitos y objetivos generales.'
        : /macro|prote[ií]na|calor[ií]a|dieta|comida|nutri/i.test(d.question)
          ? `Tu objetivo actual es ${profile.goal}. Tus metas guardadas son ${profile.dailyCalories} kcal, ${profile.proteinGrams} g de proteína, ${profile.carbsGrams} g de carbohidratos y ${profile.fatGrams} g de grasas. Úsalas como referencia general; las necesidades individuales conviene revisarlas con un nutriólogo.`
          : /rutina|ejercicio|entren|m[uú]sculo|serie|repetici/i.test(d.question)
            ? 'Para planear una sesión, registra ejercicios, series y repeticiones en Mis rutinas; deja descanso suficiente y aumenta carga o volumen poco a poco cuando la técnica se mantenga estable. Si eres principiante, pide a un entrenador que revise tu técnica.'
            : 'Puedo orientarte sobre el uso de Gymia, registro de macros, objetivos y hábitos generales de entrenamiento. Cuéntame qué objetivo tienes; esta ayuda básica no reemplaza la evaluación de un profesional.';
      return json(
        await db.coachMessage.create({
          data: { profileId: profile.id, question: d.question, answer },
        }),
      );
    }
    if (body.action === 'nutritionist.request') {
      const d = z
        .object({
          goal: z.string().trim().min(3).max(100),
          message: z.string().trim().min(5).max(1000),
        })
        .parse(body);
      return json(await db.nutritionistRequest.create({ data: { profileId: profile.id, ...d } }));
    }
    return json({ error: 'Acción no reconocida.' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
