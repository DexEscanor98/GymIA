import { AppError, ensure } from '@/lib/domain';
import { Prisma } from '@/generated/prisma/client';
import { ZodError } from 'zod';
export function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
    {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    },
  );
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
      400,
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  )
    return json(
      {
        error:
          'La operación coincide con otro registro o acaba de cambiar. Actualiza e intenta de nuevo.',
      },
      409,
    );
  console.error(error);
  return json({ error: 'No se pudo completar la operación. Intenta de nuevo.' }, 500);
}
export function sameOrigin(request: Request) {
  const expected = new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').origin;
  ensure(request.headers.get('origin') === expected, 'Origen de solicitud no permitido.', 403);
  ensure(
    request.headers.get('content-type')?.includes('application/json'),
    'Se requiere JSON.',
    415,
  );
}
export async function readBody(request: Request) {
  const text = await request.text();
  ensure(text.length <= 32_000, 'Solicitud demasiado grande.', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('JSON inválido.');
  }
}
