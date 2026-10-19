import { test, expect } from '@playwright/test';
import { NoteCrypto } from '../src/services/NoteCrypto';

test('rederiva tras nueva sesión, IV único, contraseña incorrecta y corrupción', async () => {
  const first = new NoteCrypto();
  const config = await first.createConfig('contraseña de prueba');
  await first.unlock('contraseña de prueba', config);
  const a = await first.encryptNote('Texto privado áé🔒');
  const b = await first.encryptNote('Texto privado áé🔒');
  expect(a.iv).not.toEqual(b.iv);
  const next = new NoteCrypto();
  const saved = structuredClone(config);
  await next.unlock('contraseña de prueba', saved);
  expect(await next.decryptNote(a.ciphertext, a.iv)).toBe('Texto privado áé🔒');
  expect(saved.salt).toEqual(config.salt);
  expect(Object.keys(saved)).not.toContain('key');
  expect(Object.keys(saved)).not.toContain('password');
  const damaged = a.ciphertext.slice(0);
  new Uint8Array(damaged)[0] ^= 1;
  await expect(next.decryptNote(damaged, a.iv)).rejects.toThrow('dañados');
  const badIv = a.iv.slice(); badIv[0] ^= 1;
  await expect(next.decryptNote(a.ciphertext, badIv)).rejects.toThrow('dañados');
  await expect(next.unlock('incorrecta', saved)).rejects.toThrow('incorrecta');
  await expect(next.encryptNote('no guardar')).rejects.toThrow('bloqueadas');
});

test('abre configuración antigua de 100000 iteraciones sin cambiar sal', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode('anterior'), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const verifier = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('gestor-tareas:contraseña-correcta:v1'));
  const notes = new NoteCrypto();
  await notes.unlock('anterior', { id: 'encryption', salt, verifierIv: iv, verifierCiphertext: verifier });
  const note = await notes.encryptNote('Compatible');
  expect(await notes.decryptNote(note.ciphertext, note.iv)).toBe('Compatible');
});
