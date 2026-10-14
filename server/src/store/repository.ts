import crypto from 'node:crypto';
import { getDb } from './db.js';
import type {
  ChangeoverEvent,
  Equipment,
  LearningRecord,
  Material,
  Operator,
  OverviewMetrics,
  Product,
  SimulationDataset,
  Tooling,
} from '../domain/types.js';
import { computeOverview } from '../engine/seed.js';

function parseRows<T>(rows: unknown[]): T[] {
  return rows.map((r) => JSON.parse((r as { json: string }).json) as T);
}

export interface Counts {
  products: number;
  materials: number;
  equipment: number;
  toolings: number;
  operators: number;
  events: number;
}

export const repository = {
  get meta() {
    return {
      get(key: string): string | null {
        const row = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
          | { value: string }
          | undefined;
        return row?.value ?? null;
      },
      set(key: string, value: string): void {
        getDb()
          .prepare(
            'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          )
          .run(key, value);
      },
    };
  },

  counts(): Counts {
    const one = (table: string) =>
      (getDb().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
    return {
      products: one('products'),
      materials: one('materials'),
      equipment: one('equipment'),
      toolings: one('toolings'),
      operators: one('operators'),
      events: one('events'),
    };
  },

  isEmpty(): boolean {
    return this.counts().products === 0;
  },

  getOverview(): OverviewMetrics | null {
    const raw = this.meta.get('overview');
    if (raw) {
      const stored = JSON.parse(raw) as OverviewMetrics;
      return { ...stored, totalEvents: this.counts().events };
    }
    const events = this.listEvents();
    if (!events.length) return null;
    return computeOverview(events, this.listLearning());
  },

  listProducts(q?: string): Product[] {
    const rows = getDb().prepare('SELECT json FROM products ORDER BY code').all();
    const items = parseRows<Product>(rows);
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((p) => p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s));
  },

  getProduct(code: string): Product | null {
    const row = getDb().prepare('SELECT json FROM products WHERE code = ?').get(code) as
      | { json: string }
      | undefined;
    return row ? (JSON.parse(row.json) as Product) : null;
  },

  listMaterials(opts: { q?: string; category?: string; limit?: number; offset?: number } = {}): {
    total: number;
    items: Material[];
  } {
    const db = getDb();
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (opts.category) {
      clauses.push('category = ?');
      params.push(opts.category);
    }
    if (opts.q) {
      clauses.push('(sku LIKE ? OR json LIKE ?)');
      params.push(`%${opts.q}%`, `%${opts.q}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = (
      db.prepare(`SELECT COUNT(*) AS c FROM materials ${where}`).get(...params) as { c: number }
    ).c;
    const rows = db
      .prepare(`SELECT json FROM materials ${where} ORDER BY sku LIMIT ? OFFSET ?`)
      .all(...params, opts.limit ?? 50, opts.offset ?? 0);
    return { total, items: parseRows<Material>(rows) };
  },

  materialCategories(): string[] {
    const rows = getDb().prepare('SELECT DISTINCT category FROM materials ORDER BY category').all() as {
      category: string;
    }[];
    return rows.map((r) => r.category);
  },

  listEquipment(): Equipment[] {
    return parseRows<Equipment>(getDb().prepare('SELECT json FROM equipment ORDER BY id').all());
  },

  listToolings(): Tooling[] {
    return parseRows<Tooling>(getDb().prepare('SELECT json FROM toolings ORDER BY id').all());
  },

  listOperators(): Operator[] {
    return parseRows<Operator>(getDb().prepare('SELECT json FROM operators ORDER BY id').all());
  },

  listScenarios() {
    return parseRows<import('../domain/types.js').ExceptionScenario>(
      getDb().prepare('SELECT json FROM scenarios ORDER BY id').all(),
    );
  },

  listEvents(opts: { scenario?: string; success?: boolean; limit?: number; offset?: number } = {}): ChangeoverEvent[] {
    const db = getDb();
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (opts.scenario) {
      clauses.push('scenario = ?');
      params.push(opts.scenario);
    }
    if (opts.success !== undefined) {
      clauses.push('success = ?');
      params.push(opts.success ? 1 : 0);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT json FROM events ${where} ORDER BY sequence LIMIT ? OFFSET ?`)
      .all(...params, opts.limit ?? 200, opts.offset ?? 0);
    return parseRows<ChangeoverEvent>(rows);
  },

  countEvents(opts: { scenario?: string; success?: boolean } = {}): number {
    const db = getDb();
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (opts.scenario) {
      clauses.push('scenario = ?');
      params.push(opts.scenario);
    }
    if (opts.success !== undefined) {
      clauses.push('success = ?');
      params.push(opts.success ? 1 : 0);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return (db.prepare(`SELECT COUNT(*) AS c FROM events ${where}`).get(...params) as { c: number }).c;
  },

  getEvent(id: string): ChangeoverEvent | null {
    const row = getDb().prepare('SELECT json FROM events WHERE id = ?').get(id) as
      | { json: string }
      | undefined;
    return row ? (JSON.parse(row.json) as ChangeoverEvent) : null;
  },

  listLearning(): LearningRecord[] {
    return parseRows<LearningRecord>(
      getDb().prepare('SELECT json FROM learning ORDER BY sequence').all(),
    );
  },

  eventSummaries(opts: { limit?: number; offset?: number; scenario?: string; success?: boolean } = {}) {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (opts.scenario) {
      clauses.push('scenario = ?');
      params.push(opts.scenario);
    }
    if (opts.success !== undefined) {
      clauses.push('success = ?');
      params.push(opts.success ? 1 : 0);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = getDb()
      .prepare(
        `SELECT id, sequence, day, line, scenario, from_product AS fromProduct, to_product AS toProduct,
                baseline_minutes AS baselineMinutes, actual_minutes AS actualMinutes,
                saved_ratio AS savedRatio, success, quality_passed AS qualityPassed, json
         FROM events ${where} ORDER BY sequence LIMIT ? OFFSET ?`,
      )
      .all(...params, opts.limit ?? 200, opts.offset ?? 0) as Record<string, unknown>[];
    return rows.map((r) => {
      const full = JSON.parse(r.json as string) as ChangeoverEvent;
      return {
        id: r.id,
        sequence: r.sequence,
        day: r.day,
        line: r.line,
        fromProduct: r.fromProduct,
        toProduct: r.toProduct,
        scenario: r.scenario,
        baselineMinutes: r.baselineMinutes,
        actualMinutes: r.actualMinutes,
        savedMinutes: Math.round(((r.baselineMinutes as number) - (r.actualMinutes as number)) * 10) / 10,
        savedRatio: r.savedRatio,
        oeeBefore: full.oeeBefore,
        oeeAfter: full.oeeAfter,
        success: Boolean(r.success),
        qualityPassed: Boolean(r.qualityPassed),
        bottleneck: full.bottleneck,
        parallelism: full.schedule.parallelism,
      };
    });
  },

  replaceDataset(dataset: SimulationDataset, seed: number): void {
    const db = getDb();
    db.exec('BEGIN');
    try {
      for (const t of ['products', 'materials', 'equipment', 'toolings', 'operators', 'scenarios', 'events', 'learning']) {
        db.exec(`DELETE FROM ${t}`);
      }
      const insProduct = db.prepare('INSERT INTO products (code, json) VALUES (?, ?)');
      for (const p of dataset.products) insProduct.run(p.code, JSON.stringify(p));

      const insMaterial = db.prepare('INSERT INTO materials (sku, category, json) VALUES (?, ?, ?)');
      for (const m of dataset.materials) insMaterial.run(m.sku, m.category, JSON.stringify(m));

      const insEquipment = db.prepare('INSERT INTO equipment (id, json) VALUES (?, ?)');
      for (const e of dataset.equipment) insEquipment.run(e.id, JSON.stringify(e));

      const insTooling = db.prepare('INSERT INTO toolings (id, json) VALUES (?, ?)');
      for (const t of dataset.toolings) insTooling.run(t.id, JSON.stringify(t));

      const insOperator = db.prepare('INSERT INTO operators (id, json) VALUES (?, ?)');
      for (const o of dataset.operators) insOperator.run(o.id, JSON.stringify(o));

      const insScenario = db.prepare('INSERT INTO scenarios (id, json) VALUES (?, ?)');
      for (const s of dataset.scenarios) insScenario.run(s.id, JSON.stringify(s));

      const insEvent = db.prepare(
        `INSERT INTO events (id, sequence, day, line, scenario, from_product, to_product,
           baseline_minutes, actual_minutes, saved_ratio, success, quality_passed, json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const e of dataset.events) {
        insEvent.run(
          e.id, e.sequence, e.day, e.line, e.scenario, e.fromProduct, e.toProduct,
          e.baselineMinutes, e.actualMinutes, e.savedRatio, e.success ? 1 : 0,
          e.qualityPassed ? 1 : 0, JSON.stringify(e),
        );
      }

      const insLearning = db.prepare('INSERT INTO learning (sequence, json) VALUES (?, ?)');
      for (const l of dataset.learning) insLearning.run(l.sequence, JSON.stringify(l));

      this.meta.set('overview', JSON.stringify(dataset.overview));
      this.meta.set('generatedAt', dataset.generatedAt);
      this.meta.set('timeSpanDays', String(dataset.timeSpanDays));
      this.meta.set('seed', String(seed));
      this.meta.set('datasetVersion', String(Number(this.meta.get('datasetVersion') ?? '0') + 1));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  upsertProducts(items: Product[], mode: 'merge' | 'replace'): number {
    const db = getDb();
    db.exec('BEGIN');
    try {
      if (mode === 'replace') db.exec('DELETE FROM products');
      const stmt = db.prepare(
        'INSERT INTO products (code, json) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET json = excluded.json',
      );
      for (const p of items) stmt.run(p.code, JSON.stringify(p));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return items.length;
  },

  upsertMaterials(items: Material[], mode: 'merge' | 'replace'): number {
    const db = getDb();
    db.exec('BEGIN');
    try {
      if (mode === 'replace') db.exec('DELETE FROM materials');
      const stmt = db.prepare(
        'INSERT INTO materials (sku, category, json) VALUES (?, ?, ?) ON CONFLICT(sku) DO UPDATE SET category = excluded.category, json = excluded.json',
      );
      for (const m of items) stmt.run(m.sku, m.category, JSON.stringify(m));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return items.length;
  },

  upsertEquipment(items: Equipment[], mode: 'merge' | 'replace'): number {
    const db = getDb();
    db.exec('BEGIN');
    try {
      if (mode === 'replace') db.exec('DELETE FROM equipment');
      const stmt = db.prepare(
        'INSERT INTO equipment (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
      );
      for (const e of items) stmt.run(e.id, JSON.stringify(e));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return items.length;
  },

  upsertOperators(items: Operator[], mode: 'merge' | 'replace'): number {
    const db = getDb();
    db.exec('BEGIN');
    try {
      if (mode === 'replace') db.exec('DELETE FROM operators');
      const stmt = db.prepare(
        'INSERT INTO operators (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
      );
      for (const o of items) stmt.run(o.id, JSON.stringify(o));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return items.length;
  },

  nextEventSequence(): number {
    const row = getDb().prepare('SELECT COALESCE(MAX(sequence), 0) AS m FROM events').get() as { m: number };
    return row.m + 1;
  },

  listWorkorders(opts: { limit?: number; offset?: number } = {}): Record<string, unknown>[] {
    return getDb()
      .prepare('SELECT * FROM workorders ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(opts.limit ?? 100, opts.offset ?? 0) as Record<string, unknown>[];
  },

  countWorkorders(): number {
    return (getDb().prepare('SELECT COUNT(*) AS c FROM workorders').get() as { c: number }).c;
  },

  recordWorkorders(
    batchId: string,
    items: Array<{
      fromProduct: string;
      toProduct: string;
      scenario: string;
      line?: string;
      day?: number;
      plannedStartMinute?: number;
    }>,
  ): void {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO workorders (batch_id, from_product, to_product, scenario, line, day, planned_start_minute, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const ts = new Date().toISOString();
    db.exec('BEGIN');
    try {
      for (const it of items) {
        stmt.run(
          batchId,
          it.fromProduct,
          it.toProduct,
          it.scenario,
          it.line ?? null,
          it.day ?? null,
          it.plannedStartMinute ?? null,
          ts,
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  appendEvents(events: ChangeoverEvent[]): number {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO events (id, sequence, day, line, scenario, from_product, to_product,
         baseline_minutes, actual_minutes, saved_ratio, success, quality_passed, json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    );
    db.exec('BEGIN');
    try {
      for (const e of events) {
        stmt.run(
          e.id, e.sequence, e.day, e.line, e.scenario, e.fromProduct, e.toProduct,
          e.baselineMinutes, e.actualMinutes, e.savedRatio, e.success ? 1 : 0,
          e.qualityPassed ? 1 : 0, JSON.stringify(e),
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    this.recomputeOverview();
    return events.length;
  },

  recomputeOverview(): OverviewMetrics | null {
    const events = this.listEvents();
    if (!events.length) return null;
    const overview = computeOverview(events, this.listLearning());
    this.meta.set('overview', JSON.stringify(overview));
    return overview;
  },

  recordImport(batch: {
    kind: string;
    filename?: string;
    mode: string;
    total: number;
    imported: number;
    failed: number;
    errors: unknown[];
  }): string {
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO import_batches (id, kind, filename, mode, total, imported, failed, errors_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, batch.kind, batch.filename ?? null, batch.mode,
        batch.total, batch.imported, batch.failed,
        JSON.stringify(batch.errors.slice(0, 100)), new Date().toISOString(),
      );
    this.meta.set('importVersion', String(Number(this.meta.get('importVersion') ?? '0') + 1));
    return id;
  },

  listImports(limit = 50) {
    return getDb()
      .prepare('SELECT * FROM import_batches ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
  },

  audit(entry: {
    requestId?: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    ip?: string;
  }): void {
    getDb()
      .prepare(
        'INSERT INTO audit_log (ts, request_id, method, path, status, duration_ms, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(new Date().toISOString(), entry.requestId ?? null, entry.method, entry.path, entry.status, entry.durationMs, entry.ip ?? null);
  },

  listAudit(limit = 100) {
    return getDb()
      .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
  },
};
