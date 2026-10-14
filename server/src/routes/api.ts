import { Router } from 'express';
import { repository } from '../store/repository.js';
import { computeAgentStates } from '../runtime/state.js';
import { generateAndStore } from '../runtime/bootstrap.js';
import { assembleEvent, findScenario } from '../engine/seed.js';
import { Rng } from '../engine/random.js';
import { asyncHandler } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { paginationSchema, parse, regenerateSchema, simulateSchema } from '../lib/validate.js';
import { eventBus } from '../lib/eventBus.js';
import { runChangeoverWithProgress } from '../runtime/liveSimulator.js';
import type { Product } from '../domain/types.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'changeover-server',
    version: '2.0.0',
    uptimeSeconds: Math.round(process.uptime()),
    generatedAt: repository.meta.get('generatedAt'),
  });
});

router.get('/ready', (_req, res) => {
  try {
    const counts = repository.counts();
    res.json({ status: 'ready', database: 'ok', counts });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', database: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/overview', (_req, res) => {
  const overview = repository.getOverview();
  const counts = repository.counts();
  if (!overview) return res.json({ totalEvents: 0, ...counts });
  res.json({
    ...overview,
    timeSpanDays: Number(repository.meta.get('timeSpanDays') ?? 30),
    productCount: counts.products,
    materialCount: counts.materials,
    equipmentCount: counts.equipment,
    toolingCount: counts.toolings,
    operatorCount: counts.operators,
  });
});

router.get('/meta', (_req, res) => {
  res.json({
    generatedAt: repository.meta.get('generatedAt'),
    timeSpanDays: Number(repository.meta.get('timeSpanDays') ?? 30),
    seed: Number(repository.meta.get('seed') ?? 0),
    datasetVersion: Number(repository.meta.get('datasetVersion') ?? 0),
    counts: repository.counts(),
    scenarios: repository.listScenarios(),
    agentNames: {
      scheduling: '调度智能体',
      equipment: '设备智能体',
      material: '物料智能体',
      tooling: '工装智能体',
      quality: '质量智能体',
      employee: '人员调度智能体',
    },
  });
});

router.get('/products', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const items = repository.listProducts(q);
  res.json({ total: items.length, items });
});

router.get('/products/:code', (req, res) => {
  const product = repository.getProduct(req.params.code);
  if (!product) throw notFound('产品不存在');
  res.json(product);
});

router.get('/materials', (req, res) => {
  const { limit, offset } = parse(paginationSchema, req.query);
  const q = String(req.query.q ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  const { total, items } = repository.listMaterials({ q, category, limit, offset });
  res.setHeader('X-Total-Count', String(total));
  res.json({ total, categories: repository.materialCategories(), items });
});

router.get('/equipment', (_req, res) => {
  const items = repository.listEquipment();
  res.json({ total: items.length, items });
});

router.get('/toolings', (_req, res) => {
  const items = repository.listToolings();
  res.json({ total: items.length, items });
});

router.get('/operators', (_req, res) => {
  const items = repository.listOperators();
  res.json({ total: items.length, items });
});

router.get('/events', (req, res) => {
  const { limit, offset } = parse(paginationSchema, req.query);
  const scenario = req.query.scenario ? String(req.query.scenario) : undefined;
  const success = req.query.success !== undefined ? String(req.query.success) === 'true' : undefined;
  const items = repository.eventSummaries({ limit, offset, scenario, success });
  const total = repository.countEvents({ scenario, success });
  res.setHeader('X-Total-Count', String(total));
  res.json({ total, items });
});

router.get('/events/:id', (req, res) => {
  const event = repository.getEvent(req.params.id);
  if (!event) throw notFound('换产事件不存在');
  res.json(event);
});

router.get('/agents', (_req, res) => {
  res.json({ items: computeAgentStates() });
});

router.get('/workorders', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const items = repository.listWorkorders({ limit, offset });
  const total = repository.countWorkorders();
  res.setHeader('X-Total-Count', String(total));
  res.json({ total, items });
});

router.get('/learning', (_req, res) => {
  res.json({ items: repository.listLearning() });
});

router.get('/learning/insights', (_req, res) => {
  const items = repository.listLearning();
  if (!items.length) {
    return res.json({ totalCount: 0, avgAccuracy: 0, avgParallelism: 0, byDay: [], recent: [] });
  }
  const avgAccuracy = Math.round(
    (items.reduce((a, x) => a + x.accuracy, 0) / items.length) * 1000,
  ) / 1000;
  const avgParallelism = Math.round(
    (items.reduce((a, x) => a + x.parallelism, 0) / items.length) * 1000,
  ) / 1000;
  const dayMap = new Map<number, { day: number; samples: number; avgAccuracy: number; avgMakespan: number }>();
  for (const x of items) {
    const cur = dayMap.get(x.day) ?? { day: x.day, samples: 0, avgAccuracy: 0, avgMakespan: 0 };
    cur.samples += 1;
    cur.avgAccuracy = (cur.avgAccuracy * (cur.samples - 1) + x.accuracy) / cur.samples;
    cur.avgMakespan = (cur.avgMakespan * (cur.samples - 1) + x.makespan) / cur.samples;
    dayMap.set(x.day, cur);
  }
  res.json({
    totalCount: items.length,
    avgAccuracy,
    avgParallelism,
    byDay: Array.from(dayMap.values())
      .map((d) => ({
        day: d.day,
        samples: d.samples,
        avgAccuracy: Math.round(d.avgAccuracy * 1000) / 1000,
        avgMakespan: Math.round(d.avgMakespan * 100) / 100,
      }))
      .sort((a, b) => a.day - b.day),
    recent: items.slice(-10).reverse(),
  });
});

router.get('/learning/strategies', (_req, res) => {
  const items = repository.listLearning();
  if (!items.length) {
    return res.json({ items: [], latest: null });
  }
  const sumParams = {
    parallelThreshold: 0,
    materialLeadSeconds: 0,
    inspectionBuffer: 0,
    agvCount: 0,
    preLoadRatio: 0,
    operatorFlexibility: 0,
  };
  let sumAccuracy = 0;
  let sumMakespan = 0;
  let sumParallelism = 0;
  for (const x of items) {
    sumParams.parallelThreshold += x.params.parallelThreshold;
    sumParams.materialLeadSeconds += x.params.materialLeadSeconds;
    sumParams.inspectionBuffer += x.params.inspectionBuffer;
    sumParams.agvCount += x.params.agvCount;
    sumParams.preLoadRatio += x.params.preLoadRatio;
    sumParams.operatorFlexibility += x.params.operatorFlexibility;
    sumAccuracy += x.accuracy;
    sumMakespan += x.makespan;
    sumParallelism += x.parallelism;
  }
  const n = items.length;
  const avg = {
    parallelThreshold: Math.round((sumParams.parallelThreshold / n) * 1000) / 1000,
    materialLeadSeconds: Math.round((sumParams.materialLeadSeconds / n) * 100) / 100,
    inspectionBuffer: Math.round((sumParams.inspectionBuffer / n) * 100) / 100,
    agvCount: Math.round((sumParams.agvCount / n) * 1000) / 1000,
    preLoadRatio: Math.round((sumParams.preLoadRatio / n) * 1000) / 1000,
    operatorFlexibility: Math.round((sumParams.operatorFlexibility / n) * 1000) / 1000,
  };
  const latest = items[items.length - 1];
  res.json({
    samples: n,
    avgAccuracy: Math.round((sumAccuracy / n) * 1000) / 1000,
    avgMakespan: Math.round((sumMakespan / n) * 100) / 100,
    avgParallelism: Math.round((sumParallelism / n) * 1000) / 1000,
    paramsAvg: avg,
    latestParams: latest.params,
    latestAccuracy: latest.accuracy,
  });
});

router.get('/scenarios', (_req, res) => {
  res.json({ items: repository.listScenarios() });
});

router.get('/compare', (_req, res) => {
  const overview = repository.getOverview();
  if (!overview) return res.status(404).json({ error: { code: 'NO_DATA', message: '暂无数据' } });
  const events = repository.listEvents({ limit: 10000 });
  const avgSaved = events.length
    ? Math.round((events.reduce((a, e) => a + e.savedMinutes, 0) / events.length) * 10) / 10
    : 0;
  res.json({
    baseline: {
      changeoverMinutes: overview.baselineChangeoverMinutes,
      oee: overview.baselineOee,
      operators: overview.operatorsBaseline,
      mode: '传统人工经验模式（静态串行计划）',
    },
    optimized: {
      changeoverMinutes: overview.avgChangeoverMinutes,
      oee: overview.oee,
      operators: overview.operatorsOptimized,
      mode: '多智能体协同模式（动态并行编排）',
    },
    reduction: {
      changeover: overview.reductionRatio,
      oeeGain: Math.round((overview.oee - overview.baselineOee) * 10) / 10,
      operator: overview.operatorReduction,
    },
    targets: { changeoverMinutes: overview.targetChangeoverMinutes, oee: 80, operatorReduction: 20 },
    baselineAvgSaved: avgSaved,
  });
});

router.get('/audit', (_req, res) => {
  res.json({ items: repository.listAudit(100) });
});

router.get('/imports', (_req, res) => {
  res.json({ items: repository.listImports(50) });
});

router.post(
  '/regenerate',
  asyncHandler(async (req, res) => {
    const { seed } = parse(regenerateSchema, req.body ?? {});
    generateAndStore(seed);
    res.json({ ok: true, overview: repository.getOverview(), counts: repository.counts() });
  }),
);

router.post(
  '/simulate',
  asyncHandler(async (req, res) => {
    const body = parse(simulateSchema, req.body ?? {});
    const seed = body.seed ?? Math.floor(Date.now() % 1_000_000);
    const rng = new Rng(seed);

    const products = repository.listProducts();
    if (!products.length) throw notFound('无产品数据，请先导入或生成数据集');

    const from: Product = (body.from && repository.getProduct(body.from)) || rng.pick(products);
    let to: Product = (body.to && repository.getProduct(body.to)) || rng.pick(products);
    if (to.code === from.code) to = products.find((p) => p.code !== from.code) ?? to;

    const scenarioType = body.scenario ?? 'normal';
    const scenario = findScenario(scenarioType);
    const event = assembleEvent({
      from,
      to,
      scenario,
      rng,
      equipment: repository.listEquipment(),
      id: `LIVE-${seed}`,
      line: undefined,
    });

    runChangeoverWithProgress(event).catch(() => undefined);
    res.json(event);
  }),
);

export default router;
