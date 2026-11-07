import { db } from '@/lib/db';
import { allow, ensure, AppError } from '@/lib/domain';
import { context } from '@/server/context';
import { json, errorResponse, sameOrigin } from '@/server/http';
import { MAX_LOGO_INPUT, optimizeLogo, saveLogo } from '@/server/logo';
export const runtime = 'nodejs';
function origin(request: Request) {
  ensure(
    request.headers.get('origin') ===
      new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').origin,
    'Origen de solicitud no permitido.',
    403,
  );
}
export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get('tenant');
    ensure(tenantId, 'Gimnasio requerido.');
    const c = await context(tenantId);
    const logo = await db.tenantLogo.findUnique({ where: { tenantId: c.tenantId } });
    ensure(logo, 'No hay un logo.', 404);
    return new Response(new Uint8Array(logo.data), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(logo.data.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    origin(request);
    const tenantId = request.headers.get('x-tenant-id');
    ensure(tenantId, 'Gimnasio requerido.');
    const c = await context(tenantId);
    allow(c.role, ['OWNER']);
    ensure(
      ['image/jpeg', 'image/png', 'image/webp'].includes(request.headers.get('content-type') || ''),
      'Usa PNG, JPEG o WebP.',
      415,
    );
    const reader = request.body?.getReader();
    ensure(reader, 'Selecciona una imagen.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_LOGO_INPUT) {
          await reader.cancel();
          throw new AppError('Máximo 5 MB por archivo.', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let output: Buffer;
    try {
      output = await optimizeLogo(Buffer.concat(chunks));
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('La imagen no se pudo leer. Usa un PNG, JPEG o WebP válido.');
    }
    return json(await saveLogo(c, output));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const tenantId = request.headers.get('x-tenant-id');
    ensure(tenantId, 'Gimnasio requerido.');
    return json(await saveLogo(await context(tenantId), null));
  } catch (e) {
    return errorResponse(e);
  }
}
