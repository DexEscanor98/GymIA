import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { transaction } from '@/server/common';
import { ensure } from '@/lib/domain';
import { json, errorResponse, sameOrigin, readBody } from '@/server/http';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await auth.api.getSession({ headers: await headers() });
    ensure(session, 'Inicia sesión.', 401);
    const d = z
      .object({
        name: z.string().trim().min(2).max(80),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9][a-z0-9-]{2,39}$/,
            'Usa entre 3 y 40 caracteres: letras, números y guiones; comienza con letra o número.',
          ),
      })
      .parse(await readBody(request));
    const result = await transaction(async (tx) => {
      ensure(
        (await tx.access.count({ where: { userId: session.user.id, role: 'OWNER' } })) < 5,
        'Contacta con soporte para crear más organizaciones.',
      );
      const tenant = await tx.tenant.create({
        data: {
          ...d,
          accesses: { create: { userId: session.user.id, role: 'OWNER' } },
          branches: { create: { name: 'Principal' } },
        },
        include: { branches: true },
      });
      await tx.schedule.createMany({
        data: Array.from({ length: 7 }, (_, weekday) => ({
          tenantId: tenant.id,
          branchId: tenant.branches[0].id,
          weekday,
          opens: '06:00',
          closes: '22:00',
          closed: weekday === 0,
        })),
      });
      return tenant;
    });
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
