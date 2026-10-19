import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Chromium informa manifiesto instalable y emite prompt nativo', async ({}, testInfo) => {
  // Los contextos efímeros normales de Playwright son incógnito: no permiten instalar.
  const profile = await mkdtemp(join(tmpdir(), 'gestor-install-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true });
  try {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  await expect.poll(async () => (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors, { timeout: 15000 }).toEqual([]);
  await expect(page.locator('#install')).toBeVisible({ timeout: 15000 });
  const manifest = await cdp.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('install-button.png'), fullPage: true });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
