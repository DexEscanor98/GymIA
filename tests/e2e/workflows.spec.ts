import { test, expect } from '@playwright/test';
async function login(page: import('@playwright/test').Page, email = 'dueno@gymia.test') {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Buen día|Tu próximo entrenamiento/ }),
  ).toBeVisible();
}
test('dueño: acceso a todos los módulos, catálogo real y cierre de sesión', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1024 });
  await login(page);
  await page.screenshot({ path: 'test-results/desktop-overview.png', fullPage: true });
  for (const label of [
    'Clientes',
    'Membresías',
    'Productos',
    'Ventas',
    'Caja y turnos',
    'Accesos',
    'Entrenamiento',
    'Equipo',
    'Horarios',
    'Configuración',
  ]) {
    await page.locator('nav').getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.page-heading h1')).toBeVisible();
  }
  await page.locator('nav').getByRole('button', { name: 'Productos', exact: true }).click();
  await expect(page.getByText('Preentreno · porción')).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByTitle('Cerrar sesión').click();
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});
test('cliente: QR, cuenta propia y diseño móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('cliente@gymia.test');
  await page.getByLabel('Contraseña').fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mariana López', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mostrar mi QR' })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-client.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Mostrar mi QR' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR de acceso de Mariana López' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(
    page.locator('nav').getByRole('button', { name: 'Ventas', exact: true }),
  ).toHaveCount(0);
});
test('API: bloquea sesiones anónimas y origen externo', async ({ request }) => {
  expect((await request.get('/api/workspace')).status()).toBe(401);
  expect(
    (
      await request.post('/api/operations', {
        headers: { origin: 'https://untrusted.example' },
        data: { action: 'shift.open', input: {} },
      })
    ).status(),
  ).toBe(403);
});

test('espacio personal: registra cuenta independiente, ID Gymia y rutina propia', async ({
  page,
}) => {
  const { randomUUID } = await import('node:crypto');
  const { db } = await import('../../src/lib/db');
  const email = `personal-${randomUUID()}@gymia.test`;
  const password = randomUUID() + 'Aa1!';
  try {
    await page.goto('/register');
    await page.getByLabel('Nombre completo').fill('Atleta de prueba');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await expect(page).toHaveURL(/personal/);
    await expect(page.getByRole('heading', { name: 'Hola, Atleta.' })).toBeVisible();
    await expect(page.locator('.personal-id strong')).toHaveText(/^GYM-[A-F0-9]{20}$/);
    await page.getByLabel('Nombre de rutina').fill('Rutina de prueba');
    await page.getByLabel('Ejercicios y notas').fill('Sentadillas 3 x 8');
    await page.getByRole('button', { name: 'Guardar rutina' }).click();
    await expect(page.getByText('Rutina de prueba')).toBeVisible();
  } finally {
    await db.user.deleteMany({ where: { email } });
  }
});

test('nuevo dueño: registro de gimnasio, logo optimizado y aislamiento', async ({
  page,
  browser,
  request,
}) => {
  const { randomUUID } = await import('node:crypto');
  const { db } = await import('../../src/lib/db');
  const sharp = (await import('sharp')).default;
  const suffix = randomUUID().slice(0, 8);
  const email = `onboarding-${suffix}@gymia.test`;
  const slug = `gimnasio-${suffix}`;
  const password = randomUUID();
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error('Solo base local');
  const outsider = await browser.newContext();
  try {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Registrar mi gimnasio' }).click();
    await expect(page.getByRole('heading', { name: 'Registra tu gimnasio' })).toBeVisible();
    await page.getByLabel('Nombre completo').fill('Dueño prueba');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear cuenta de dueño' }).click();
    await page.getByLabel('Nombre del gimnasio').fill('Gimnasio nuevo');
    await page.getByLabel('Identificador único').fill(slug);
    await page.getByRole('button', { name: 'Crear mi gimnasio' }).click();
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.locator('nav').getByRole('button', { name: 'Configuración', exact: true }).click();
    const fixture = await sharp({
      create: { width: 1400, height: 700, channels: 4, background: '#c5f36b80' },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel('Seleccionar logo')
      .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: fixture });
    await page.getByRole('button', { name: 'Guardar logo', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Logo guardado en alta calidad');
    const image = page.getByRole('img', { name: 'Logo actual del gimnasio' });
    await expect(image).toBeVisible();
    const url = (await image.getAttribute('src'))!;
    const own = await page.request.get(url);
    expect(own.status()).toBe(200);
    expect(own.headers()['content-type']).toBe('image/webp');
    expect((await request.get(url)).status()).toBe(401);
    const otherPage = await outsider.newPage();
    await login(otherPage);
    expect((await otherPage.request.get(url)).status()).toBe(403);
    await page.getByRole('button', { name: 'Quitar logo', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Logo quitado');
    expect((await page.request.get(url)).status()).toBe(404);
  } finally {
    await outsider.close();
    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (tenant) {
      await db.auditLog.deleteMany({ where: { tenantId: tenant.id } });
      await db.schedule.deleteMany({ where: { tenantId: tenant.id } });
      await db.access.deleteMany({ where: { tenantId: tenant.id } });
      await db.branch.deleteMany({ where: { tenantId: tenant.id } });
      await db.tenant.delete({ where: { id: tenant.id } });
    }
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
