import { Router } from 'express';
import type { Request, Response } from 'express';
import { eventBus } from '../lib/eventBus.js';
import { asyncHandler } from '../lib/http.js';
import { badRequest } from '../lib/errors.js';
import { toRows } from '../lib/parsers.js';
import { importBodySchema, importKindSchema, parse } from '../lib/validate.js';
import {
  normalizeEquipment,
  normalizeMaterials,
  normalizeOperators,
  normalizeProducts,
  normalizeWorkorders,
  templateFor,
  type ImportResult,
} from '../engine/importers.js';
import { repository } from '../store/repository.js';
import { assembleEvent, findScenario } from '../engine/seed.js';
import { Rng } from '../engine/random.js';
import type { ChangeoverEvent, Product } from '../domain/types.js';

const router = Router();
let pendingWorkorders: ReturnType<typeof normalizeWorkorders>['items'] | null = null;

router.get('/:kind/template', (req, res) => {
  const kind = importKindSchema.safeParse(req.params.kind);
  if (!kind.success) throw badRequest('不支持的导入类型');
  res.type('text/csv').send(templateFor(kind.data));
});

router.get('/batches', (_req, res) => {
  res.json({ items: repository.listImports(50) });
});

router.post(
  '/:kind',
  asyncHandler(async (req: Request, res: Response) => {
    const kind = parse(importKindSchema, req.params.kind);
    const body = parse(importBodySchema, req.body ?? {});
    const rows = toRows(body.content, body.format);
    if (!rows.length) throw badRequest('导入内容为空');

    const upsertMode: 'merge' | 'replace' = body.mode === 'replace' ? 'replace' : 'merge';
    let result: ImportResult<unknown>;
    let imported = 0;
    let generatedEvents: ChangeoverEvent[] = [];

    switch (kind) {
      case 'products': {
        const r = normalizeProducts(rows);
        imported = repository.upsertProducts(r.items, upsertMode);
        result = r;
        break;
      }
      case 'materials': {
        const r = normalizeMaterials(rows);
        imported = repository.upsertMaterials(r.items, upsertMode);
        result = r;
        break;
      }
      case 'equipment': {
        const r = normalizeEquipment(rows);
        imported = repository.upsertEquipment(r.items, upsertMode);
        result = r;
        break;
      }
      case 'operators': {
        const r = normalizeOperators(rows);
        imported = repository.upsertOperators(r.items, upsertMode);
        result = r;
        break;
      }
      case 'workorders': {
        const r = normalizeWorkorders(rows);
        generatedEvents = buildWorkorderEvents(r.items);
        imported = repository.appendEvents(generatedEvents);
        result = { items: r.items, total: r.total, errors: r.errors };
        pendingWorkorders = r.items;
        break;
      }
      default:
        throw badRequest('不支持的导入类型');
    }

    const batchId = repository.recordImport({
      kind,
      filename: body.filename,
      mode: body.mode,
      total: result.total,
      imported,
      failed: result.errors.length,
      errors: result.errors,
    });

    if (kind === 'workorders' && pendingWorkorders) {
      repository.recordWorkorders(batchId, pendingWorkorders);
    }

    eventBus.publish({
      ts: Date.now(),
      type: 'import',
      kind,
      imported,
      failed: result.errors.length,
      filename: body.filename,
    });

    res.json({
      batchId,
      kind,
      mode: body.mode,
      total: result.total,
      imported,
      failed: result.errors.length,
      errors: result.errors.slice(0, 50),
      counts: repository.counts(),
    });
  }),
);

function buildWorkorderEvents(orders: ReturnType<typeof normalizeWorkorders>['items']): ChangeoverEvent[] {
  const products = repository.listProducts();
  const byCode = new Map(products.map((p) => [p.code, p]));
  const equipment = repository.listEquipment();
  let sequence = repository.nextEventSequence();

  return orders.map((order, i) => {
    const rng = new Rng(100000 + i * 7919 + order.toProduct.length);
    const from = byCode.get(order.fromProduct) ?? synthProduct(order.fromProduct);
    const to = byCode.get(order.toProduct) ?? synthProduct(order.toProduct);
    const event = assembleEvent({
      from,
      to,
      scenario: findScenario(order.scenario as never),
      rng,
      equipment,
      id: `IMP-${Date.now().toString(36)}-${i + 1}`,
      sequence: sequence++,
      day: order.day ?? 1,
      line: order.line,
      plannedStartMinute: order.plannedStartMinute,
    });
    return event;
  });
}

function synthProduct(code: string): Product {
  return {
    code,
    name: `PCBA-${code}`,
    faces: ['TOP'],
    quantity: 0,
    materialCount: 0,
    totalComponents: 0,
    batches: [],
    route: ['下线清线', '锡膏印刷', 'SPI锡膏检测', '高速贴片', '回流焊接', 'AOI光学检测', '首件检验', '恢复生产'],
    baseChangeoverMinutes: 30,
    complexity: 1,
  };
}

export default router;
