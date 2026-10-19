import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const label = process.argv[2] ?? 'latest';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Usa una etiqueta alfanumérica para el reporte.');
await mkdir('reports', { recursive: true });
const child = spawn(process.execPath, [
  'node_modules/lighthouse/cli/index.js', 'http://127.0.0.1:4173/',
  '--only-categories=performance,accessibility,best-practices,seo',
  '--output=json', '--output=html', `--output-path=reports/${label}`,
  '--chrome-flags=--headless --no-sandbox',
], { stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
