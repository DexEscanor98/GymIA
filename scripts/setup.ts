import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const envPath = '.env';
const created = !existsSync(envPath);
const password = randomBytes(24).toString('hex');
let env = created
  ? `DATABASE_URL="postgresql://gymia:${password}@127.0.0.1:55432/gymia"\nLOCAL_DB_PASSWORD="${password}"\nBETTER_AUTH_SECRET="${randomBytes(48).toString('base64url')}"\nBETTER_AUTH_URL="http://localhost:3000"\nSEED_PASSWORD="${randomBytes(12).toString('base64url')}"\n`
  : readFileSync(envPath, 'utf8');

if (!/^VAPID_PUBLIC_KEY=/m.test(env) || !/^VAPID_PRIVATE_KEY=/m.test(env)) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });
  const vapidPublicKey = Buffer.from(
    `\x04${Buffer.from(publicJwk.x!, 'base64url').toString('binary')}${Buffer.from(publicJwk.y!, 'base64url').toString('binary')}`,
    'binary',
  ).toString('base64url');
  env = env.replace(/^VAPID_PUBLIC_KEY=.*\n?/m, '').replace(/^VAPID_PRIVATE_KEY=.*\n?/m, '');
  env += `VAPID_PUBLIC_KEY="${vapidPublicKey}"\nVAPID_PRIVATE_KEY="${privateJwk.d}"\nVAPID_SUBJECT="mailto:admin@gymia.app"\n`;
  console.log('Claves VAPID para avisos push creadas y guardadas en .env.');
}

writeFileSync(envPath, env, { mode: 0o600 });
if (created) console.log('Configuración local creada. Contraseña demo en .env (SEED_PASSWORD).');
else
  console.log(
    'Se conserva la configuración existente; se añadieron variables faltantes si era necesario.',
  );
