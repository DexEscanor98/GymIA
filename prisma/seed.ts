import 'dotenv/config';
import { db } from '../src/lib/db';
import { auth } from '../src/lib/auth';
const url = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || process.env.NODE_ENV === 'production')
  throw new Error('La demostración solo se crea en desarrollo local.');
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Define SEED_PASSWORD con al menos 12 caracteres.');
const definitions = [
  ['dueno@gymia.test', 'Alex Rivera', 'OWNER'],
  ['recepcion@gymia.test', 'Sofía Martínez', 'RECEPTION'],
  ['entrenadora@gymia.test', 'Valeria Torres', 'TRAINER'],
  ['cliente@gymia.test', 'Mariana López', 'CLIENT'],
] as const;
const users: { id: string; role: 'OWNER' | 'RECEPTION' | 'TRAINER' | 'CLIENT' }[] = [];
for (const [email, name, role] of definitions) {
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    const result = await auth.api.signUpEmail({ body: { email, name, password } });
    user = await db.user.findUniqueOrThrow({ where: { id: result.user.id } });
  }
  users.push({ ...user, role });
}
if (await db.tenant.findUnique({ where: { slug: 'demo-gym' } })) {
  console.log('La demostración ya existe; se conservaron sus datos.');
  await db.$disconnect();
  process.exit(0);
}
await db.$transaction(async (tx) => {
  const tenant = await tx.tenant.create({
    data: {
      name: 'Distrito Fitness',
      slug: 'demo-gym',
      accesses: { create: users.map((u) => ({ userId: u.id, role: u.role })) },
      branches: { create: [{ name: 'Sede Centro' }, { name: 'Sede Norte' }] },
    },
    include: { branches: true },
  });
  await tx.schedule.createMany({
    data: tenant.branches.flatMap((b) =>
      Array.from({ length: 7 }, (_, weekday) => ({
        tenantId: tenant.id,
        branchId: b.id,
        weekday,
        opens: weekday === 0 ? '08:00' : '06:00',
        closes: weekday === 0 ? '14:00' : '22:00',
      })),
    ),
  });
  const basic = await tx.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Mensual esencial',
      priceCents: 65000,
      days: 30,
      allBranches: false,
      branchIds: [tenant.branches[0].id],
    },
  });
  const premium = await tx.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Mensual + entrenamiento personal',
      priceCents: 140000,
      days: 30,
      personalTraining: true,
      allBranches: true,
      branchIds: [],
    },
  });
  await tx.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Trimestral libre',
      priceCents: 175000,
      days: 90,
      allBranches: true,
      branchIds: [],
    },
  });
  await tx.product.createMany({
    data: [
      { tenantId: tenant.id, name: 'Preentreno · porción', priceCents: 4500, stock: 30 },
      { tenantId: tenant.id, name: 'Agua mineral · 600 ml', priceCents: 2500, stock: 48 },
      { tenantId: tenant.id, name: 'Proteína · porción', priceCents: 6000, stock: 25 },
      { tenantId: tenant.id, name: 'Toalla deportiva', priceCents: 18000, stock: 12 },
    ],
  });
  const names = [
    'Mariana López',
    'Diego Hernández',
    'Camila Gómez',
    'Andrés Ruiz',
    'Lucía Mendoza',
    'Mateo Silva',
  ];
  for (let i = 0; i < names.length; i++) {
    const m = await tx.member.create({
      data: {
        tenantId: tenant.id,
        name: names[i],
        email: i === 0 ? 'cliente@gymia.test' : null,
        userId: i === 0 ? users[3].id : null,
        trainerId: i % 2 === 0 ? users[2].id : null,
        preference: i % 2 === 0 ? 'WOMAN' : 'ANY',
      },
    });
    const p = i % 2 === 0 ? premium : basic;
    await tx.membership.create({
      data: {
        tenantId: tenant.id,
        memberId: m.id,
        planId: p.id,
        planName: p.name,
        startsAt: new Date(Date.now() - 10 * 86400000),
        endsAt: new Date(Date.now() + (i === 2 ? 3 : 20) * 86400000),
        paid: true,
        personalTraining: p.personalTraining,
        allBranches: p.allBranches,
        branchIds: p.branchIds,
      },
    });
  }
  await tx.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorId: users[0].id,
      action: 'demo.created',
      entityId: tenant.id,
      details: {
        note: 'Datos ficticios de desarrollo. Las membresías iniciales no representan ventas reales.',
      },
    },
  });
});
console.log(
  'Demostración creada. Cuentas: dueno / recepcion / entrenadora / cliente @gymia.test. Contraseña: SEED_PASSWORD en .env.',
);
await db.$disconnect();
