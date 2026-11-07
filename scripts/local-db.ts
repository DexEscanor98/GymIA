import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync } from 'node:fs';
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== '127.0.0.1' || url.port !== '55432')
  throw new Error('db:local solo sirve para la base de desarrollo en 127.0.0.1:55432.');
mkdirSync('.local', { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: '.local/postgres',
  user: 'gymia',
  password: process.env.LOCAL_DB_PASSWORD!,
  port: 55432,
  persistent: true,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync('.local/postgres/PG_VERSION')) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'gymia'");
await client.end();
if (!result.rowCount) await pg.createDatabase('gymia');
console.log(
  'PostgreSQL local listo en 127.0.0.1:55432. Ctrl+C para detenerlo; los datos se conservan.',
);
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
