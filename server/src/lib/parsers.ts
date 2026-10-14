import { parse } from 'csv-parse/sync';
import { badRequest } from './errors.js';

export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim();
}

export function parseCsv(text: string): Record<string, string>[] {
  try {
    const records = parse(text, {
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as Record<string, string>[];
    return records.map((row) => {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) clean[normalizeHeader(k)] = v ?? '';
      return clean;
    });
  } catch (err) {
    throw badRequest('CSV 解析失败', { message: err instanceof Error ? err.message : String(err) });
  }
}

export function parseJson(content: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(content);
    const arr = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown[] }).items) ? (data as { items: unknown[] }).items : null;
    if (!arr) throw new Error('JSON 根节点必须是数组，或包含 items 数组');
    return arr as Record<string, unknown>[];
  } catch (err) {
    throw badRequest('JSON 解析失败', { message: err instanceof Error ? err.message : String(err) });
  }
}

export function toRows(content: string, format?: 'csv' | 'json'): Record<string, unknown>[] {
  const detected = format ?? (content.trimStart().startsWith('[') || content.trimStart().startsWith('{') ? 'json' : 'csv');
  return detected === 'json' ? parseJson(content) : parseCsv(content);
}

const norm = (s: string) => s.replace(/[\s_\-（）()]/g, '').toLowerCase();

export function pick(row: Record<string, unknown>, aliases: string[]): string | undefined {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v === null || v === undefined ? '' : String(v));
  for (const alias of aliases) {
    const v = map.get(norm(alias));
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

export function pickNum(row: Record<string, unknown>, aliases: string[], fallback?: number): number | undefined {
  const raw = pick(row, aliases);
  if (raw === undefined) return fallback;
  const n = Number(raw.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}
