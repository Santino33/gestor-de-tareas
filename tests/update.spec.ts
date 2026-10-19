import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

test('actualización real del SW espera consentimiento y conserva IndexedDB', async ({ page }) => {
  let revision = 1;
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, 'http://localhost').pathname;
      const file = pathname === '/' ? '/index.html' : pathname;
      const data = await readFile(resolve('dist', `.${file}`));
      const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(file === '/sw.js' ? `${data.toString()}\n// revisión de prueba ${revision}` : data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.locator('#password-input').fill('contraseña actualización');
    await page.locator('#password-confirm').fill('contraseña actualización');
    await page.locator('#password-submit').click();
    await page.locator('#title-input').fill('Conservar al actualizar');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.locator('.task')).toContainText('Conservar al actualizar');
    revision++;
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect(page.locator('#update')).toBeVisible({ timeout: 15000 });
    await page.locator('#title-input').fill('Borrador');
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#update').click();
    await expect(page.locator('#title-input')).toHaveValue('Borrador');
    await page.locator('#title-input').fill('');
    await page.locator('#update').click();
    await expect(page.locator('#password-form')).toBeVisible();
    await page.locator('#password-input').fill('contraseña actualización');
    await page.locator('#password-submit').click();
    await expect(page.locator('.task')).toContainText('Conservar al actualizar');
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
