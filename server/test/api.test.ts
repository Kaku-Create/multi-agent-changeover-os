import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Server } from 'node:http';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changeover-api-'));
process.env.DATA_DIR = tmpDir;
process.env.DB_FILE = 'test.db';
process.env.SEED_ON_EMPTY = 'true';
process.env.SEED = '20261002';
process.env.ENABLE_LIVE_SIMULATOR = 'false';
process.env.LOG_LEVEL = 'error';
process.env.RATE_LIMIT_MAX = '10000';

let server: Server;
let base = '';

before(async () => {
  const { getDb } = await import('../src/store/db.js');
  const { seedIfEmpty } = await import('../src/runtime/bootstrap.js');
  const { createApp } = await import('../src/app.js');
  getDb();
  seedIfEmpty();
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const { closeDb } = await import('../src/store/db.js');
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const get = (p: string) => fetch(base + p);
const post = (p: string, body: unknown) =>
  fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('健康与就绪检查', async () => {
  const health = await get('/api/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const ready = await get('/api/ready');
  assert.equal(ready.status, 200);
  const body = await ready.json();
  assert.equal(body.database, 'ok');
  assert.ok(body.counts.events > 0);
});

test('总览与对比接口返回达标指标', async () => {
  const overview = (await (await get('/api/overview')).json()) as {
    avgChangeoverMinutes: number; oee: number; operatorReduction: number; totalEvents: number;
  };
  assert.ok(overview.totalEvents >= 50);
  assert.ok(overview.avgChangeoverMinutes >= 15 && overview.avgChangeoverMinutes <= 18);
  assert.ok(overview.oee >= 80);
  assert.equal(overview.operatorReduction, 20);

  const compare = (await (await get('/api/compare')).json()) as { reduction: { changeover: number } };
  assert.ok(compare.reduction.changeover > 20);
});

test('列表接口分页与总数头', async () => {
  const res = await get('/api/events?limit=5&offset=0');
  assert.equal(res.headers.get('x-total-count'), '64');
  const body = (await res.json()) as { items: unknown[] };
  assert.equal(body.items.length, 5);

  const materials = await get('/api/materials?limit=3&offset=0');
  assert.equal(materials.headers.get('x-total-count'), '1276');
  assert.equal(((await materials.json()) as { items: unknown[] }).items.length, 3);
});

test('未知资源返回 404 结构化错误', async () => {
  const res = await get('/api/events/NOT-EXIST');
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('非法参数返回 400 校验错误', async () => {
  const res = await post('/api/regenerate', { seed: -5 });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('产品 CSV 导入生效并写入导入批次', async () => {
  const content =
    '成品专用号,成品描述,面,排产数量,订单批次号,物料编码,物料描述,用量\n' +
    'API0001,api-pcb,TOP,50,B9,M900,片式电阻,2\n';
  const res = await fetch(base + '/api/import/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'csv', filename: 'api.csv', mode: 'merge', content }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { imported: number; failed: number; batchId: string };
  assert.equal(body.imported, 1);
  assert.equal(body.failed, 0);

  const product = (await (await get('/api/products/API0001')).json()) as { code: string };
  assert.equal(product.code, 'API0001');

  const batches = (await (await get('/api/imports')).json()) as { items: { kind: string }[] };
  assert.ok(batches.items.some((b) => b.kind === 'products'));
});

test('换产工单导入生成换产事件', async () => {
  const before = (await (await get('/api/meta')).json()) as { counts: { events: number } };
  const content = '源产品,目标产品,场景,产线,天,计划开始\nAPI0001,0044300864CB,agv_delay,SMT-01,3,480\n';
  const res = await fetch(base + '/api/import/workorders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'csv', mode: 'append', content }),
  });
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { imported: number }).imported, 1);
  const after = (await (await get('/api/meta')).json()) as { counts: { events: number } };
  assert.equal(after.counts.events, before.counts.events + 1);
});

test('导入模板接口返回 CSV 表头', async () => {
  const res = await get('/api/import/products/template');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /csv/);
  assert.match(await res.text(), /成品专用号/);
});

test('仿真接口返回完整事件并含协同消息', async () => {
  const res = await post('/api/simulate', { scenario: 'equipment_alarm', seed: 42 });
  assert.equal(res.status, 200);
  const event = (await res.json()) as { messages: unknown[]; scenario: string; schedule: { tasks: unknown[] } };
  assert.equal(event.scenario, 'equipment_alarm');
  assert.ok(event.messages.length > 0);
  assert.ok(event.schedule.tasks.length > 0);
});

test('审计日志记录写操作', async () => {
  const res = (await (await get('/api/audit')).json()) as { items: { method: string; path: string }[] };
  assert.ok(res.items.some((i) => i.method === 'POST' && i.path.startsWith('/api/import')));
});
