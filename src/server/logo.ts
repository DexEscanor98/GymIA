import sharp from 'sharp';
import { allow, ensure } from '@/lib/domain';
import { audit, transaction } from './common';
import type { Context } from './context';
export const MAX_LOGO_INPUT = 5 * 1024 * 1024;
export const MAX_LOGO_STORED = 256 * 1024;
export async function optimizeLogo(input: Buffer) {
  ensure(
    input.length > 0 && input.length <= MAX_LOGO_INPUT,
    'El archivo debe pesar como máximo 5 MB.',
    413,
  );
  const pipeline = sharp(input, { limitInputPixels: 25_000_000, failOn: 'warning' });
  const meta = await pipeline.metadata();
  ensure(['jpeg', 'png', 'webp'].includes(meta.format || ''), 'Usa una imagen PNG, JPEG o WebP.');
  ensure(!meta.pages || meta.pages === 1, 'El logo debe ser una imagen sin animación.');
  const data = await pipeline
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toBuffer();
  ensure(
    data.length <= MAX_LOGO_STORED,
    'La imagen sigue siendo demasiado compleja. Usa un logo más sencillo o de menor resolución; no se ha cambiado tu logo.',
    413,
  );
  return data;
}
export async function saveLogo(c: Context, data: Buffer | null) {
  allow(c.role, ['OWNER']);
  return transaction(async (tx) => {
    let logoUrl: string | null = null;
    if (data) {
      ensure(data.length <= MAX_LOGO_STORED, 'Logo demasiado grande.', 413);
      const logo = await tx.tenantLogo.upsert({
        where: { tenantId: c.tenantId },
        create: { tenantId: c.tenantId, data: new Uint8Array(data) },
        update: { data: new Uint8Array(data) },
      });
      logoUrl = `/api/logo?tenant=${encodeURIComponent(c.tenantId)}&v=${logo.updatedAt.getTime()}`;
    } else {
      await tx.tenantLogo.deleteMany({ where: { tenantId: c.tenantId } });
    }
    await tx.tenant.update({ where: { id: c.tenantId }, data: { logoUrl } });
    await audit(tx, c, data ? 'tenant.logo.upload' : 'tenant.logo.remove', c.tenantId, {
      bytes: data?.length || 0,
    });
    return { logoUrl, bytes: data?.length || 0 };
  });
}
