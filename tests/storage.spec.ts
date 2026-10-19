import { test, expect } from '@playwright/test';
import { IDBFactory } from 'fake-indexeddb';
import { TaskStorage, requestResult, transactionDone } from '../src/storage/TaskStorage';

test.beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
});

test('migra campos españoles sin sobrescribir IDs y conserva entradas inválidas', async () => {
  const storage = await TaskStorage.open();
  const legacy = { id: 'a', titulo: 'Anterior', completada: false, prioridad: 'alta', fechaCreacion: '2026-01-01T00:00:00.000Z' };
  localStorage.setItem('electiva-pwa-tareas', JSON.stringify([legacy]));
  await storage.importLegacyTasks();
  expect(await storage.getTasks()).toEqual([{ id: 'a', title: 'Anterior', completed: false, priority: 'high', createdAt: legacy.fechaCreacion }]);
  expect(localStorage.getItem('electiva-pwa-tareas')).toBeNull();
  localStorage.setItem('electiva-pwa-tareas', JSON.stringify([{ ...legacy, titulo: 'No sobrescribir' }]));
  await storage.importLegacyTasks();
  expect((await storage.getTasks())[0].title).toBe('Anterior');
  localStorage.setItem('electiva-pwa-tareas', '[{}]');
  await expect(storage.importLegacyTasks()).rejects.toThrow('inválidas');
  expect(localStorage.getItem('electiva-pwa-tareas')).toBe('[{}]');
  storage.close();
});

test('actualiza v1 sin perder tareas y una petición exitosa no confirma una transacción abortada', async () => {
  const opening = indexedDB.open('gestor-tareas-db', 1);
  opening.onupgradeneeded = () => {
    const store = opening.result.createObjectStore('tareas', { keyPath: 'id' });
    store.createIndex('porPrioridad', 'priority');
    opening.result.createObjectStore('configuracion', { keyPath: 'id' });
    store.add({ id: 'v1', createdAt: '2026-01-01', title: 'Conservar', priority: 'low', completed: false });
  };
  const old = await requestResult(opening);
  old.close();
  const storage = await TaskStorage.open();
  expect((await storage.getTasks())[0].id).toBe('v1');
  storage.close();
  const db = await requestResult(indexedDB.open('gestor-tareas-db', 2));
  expect(Array.from(db.transaction('tareas').objectStore('tareas').indexNames)).toEqual(['porFecha', 'porPrioridad']);
  const tx = db.transaction('tareas', 'readwrite');
  const assertion = expect(transactionDone(tx)).rejects.toThrow('cancelada');
  await requestResult(tx.objectStore('tareas').delete('v1'));
  tx.abort();
  await assertion;
  expect(await requestResult(db.transaction('tareas').objectStore('tareas').get('v1'))).toBeTruthy();
  db.close();
});
