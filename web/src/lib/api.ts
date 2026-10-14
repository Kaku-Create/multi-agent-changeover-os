import type {
  AgentState,
  AuditEntry,
  ChangeoverEvent,
  CompareResult,
  Equipment,
  EventSummary,
  ImportBatch,
  ImportResponse,
  LearningRecord,
  Material,
  Meta,
  Operator,
  OverviewMetrics,
  Product,
  Scenario,
  Tooling,
  WorkorderRow,
} from './types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) {
      let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
      try {
        payload = await res.json();
      } catch {
        /* non-json error */
      }
      throw new ApiError(
        res.status,
        payload.error?.code ?? 'HTTP_ERROR',
        payload.error?.message ?? `请求失败 (${res.status})`,
        payload.error?.details,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', '请求超时，请稍后重试');
    }
    throw new ApiError(0, 'NETWORK', err instanceof Error ? err.message : '网络错误');
  } finally {
    clearTimeout(timer);
  }
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown, timeoutMs = 15000) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }, timeoutMs);

export const api = {
  overview: () => get<OverviewMetrics>('/overview'),
  meta: () => get<Meta>('/meta'),
  compare: () => get<CompareResult>('/compare'),
  products: () => get<{ total: number; items: Product[] }>('/products'),
  materials: (q = '', category = '') =>
    get<{ total: number; categories: string[]; items: Material[] }>(
      `/materials?limit=200&q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`,
    ),
  equipment: () => get<{ total: number; items: Equipment[] }>('/equipment'),
  toolings: () => get<{ total: number; items: Tooling[] }>('/toolings'),
  operators: () => get<{ total: number; items: Operator[] }>('/operators'),
  events: (limit = 200) =>
    get<{ total: number; items: EventSummary[] }>(`/events?limit=${limit}`),
  event: (id: string) => get<ChangeoverEvent>(`/events/${encodeURIComponent(id)}`),
  agents: () => get<{ items: AgentState[] }>('/agents'),
  learning: () => get<{ items: LearningRecord[] }>('/learning'),
  learningInsights: () =>
    get<{
      totalCount: number;
      avgAccuracy: number;
      avgParallelism: number;
      byDay: Array<{ day: number; samples: number; avgAccuracy: number; avgMakespan: number }>;
      recent: LearningRecord[];
    }>('/learning/insights'),
  learningStrategies: () =>
    get<{
      samples: number;
      avgAccuracy: number;
      avgMakespan: number;
      avgParallelism: number;
      paramsAvg: Record<string, number>;
      latestParams: Record<string, number>;
      latestAccuracy: number;
    }>('/learning/strategies'),
  scenarios: () => get<{ items: Scenario[] }>('/scenarios'),
  workorders: (limit = 100, offset = 0) =>
    get<{ total: number; items: WorkorderRow[] }>(`/workorders?limit=${limit}&offset=${offset}`),
  regenerate: (seed?: number) =>
    post<{ ok: boolean; overview: OverviewMetrics; counts: Record<string, number> }>('/regenerate', { seed }, 60000),
  simulate: (body: { from?: string; to?: string; scenario?: string; seed?: number }) =>
    post<ChangeoverEvent>('/simulate', body),
  imports: () => get<{ items: ImportBatch[] }>('/imports'),
  audit: () => get<{ items: AuditEntry[] }>('/audit'),
  importData: (
    kind: string,
    body: { content: string; format: 'csv' | 'json'; mode: 'merge' | 'replace' | 'append'; filename?: string },
  ) => post<ImportResponse>(`/import/${kind}`, body, 60000),
  importTemplate: async (kind: string): Promise<string> => {
    const res = await fetch(`${BASE}/import/${kind}/template`);
    if (!res.ok) throw new ApiError(res.status, 'HTTP_ERROR', '模板获取失败');
    return res.text();
  },
  streamUrl: () => `${BASE}/stream`,
};

