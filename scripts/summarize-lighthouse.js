import { readFile } from 'node:fs/promises';

for (const path of process.argv.slice(2)) {
  const report = JSON.parse(await readFile(path, 'utf8'));
  console.log(JSON.stringify({
    path, date: report.fetchTime, lighthouse: report.lighthouseVersion,
    scores: Object.fromEntries(Object.entries(report.categories).map(([key, category]) => [key, category.score * 100])),
    metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift'].map(key => [key, report.audits[key]?.displayValue])),
    issues: Object.values(report.audits).filter(audit => audit.score !== null && audit.score < 1).map(audit => ({ id: audit.id, title: audit.title, score: audit.score })),
  }, null, 2));
}
