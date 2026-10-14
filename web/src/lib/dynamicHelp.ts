import type { OverviewMetrics, LearningRecord } from './types';

export interface DynamicContext {
  overview?: OverviewMetrics | null;
  records?: LearningRecord[] | null;
}

export type DynamicFormatter = (ctx: DynamicContext) => string | null;

const o = (ctx: DynamicContext) => ctx.overview;
const rs = (ctx: DynamicContext): LearningRecord[] => ctx.records ?? [];
const last = (ctx: DynamicContext): LearningRecord | undefined => rs(ctx).slice(-1)[0];

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
function fmtMin(n: number): string {
  return `${n.toFixed(1)} 分钟`;
}

export const dynamicFormatters: Record<string, DynamicFormatter> = {
  avg_changeover_minutes: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    const baseline = ov.baselineChangeoverMinutes;
    const cur = ov.avgChangeoverMinutes;
    const saved = baseline - cur;
    return `当前 ${fmtMin(cur)}（${ov.totalEvents} 次换产平均），较上线前基线 ${fmtMin(baseline)} 节省 ${fmtMin(saved)}。`;
  },
  baseline_changeover: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `基线 ${fmtMin(ov.baselineChangeoverMinutes)}，对应上线前的传统经验做法。`;
  },
  reduction_ratio: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 ${fmtPct(ov.reductionRatio)}，等于 (${fmtMin(ov.baselineChangeoverMinutes)} − ${fmtMin(ov.avgChangeoverMinutes)}) / 基线。`;
  },
  target_changeover: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    const [lo, hi] = ov.targetChangeoverMinutes;
    return `目标区间 [${lo}, ${hi}] 分钟，当前 ${fmtMin(ov.avgChangeoverMinutes)}。`;
  },
  oee: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 OEE ${fmtPct(ov.oee)}（上线前基线 ${fmtPct(ov.baselineOee)}），提升 ${fmtPct(ov.oee - ov.baselineOee)}。`;
  },
  baseline_oee: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `上线前基线 OEE ${fmtPct(ov.baselineOee)}。`;
  },
  operators_baseline: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `上线前需要 ${ov.operatorsBaseline} 人。`;
  },
  operators_optimized: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `优化后 ${ov.operatorsOptimized} 人。`;
  },
  operator_reduction: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `减少 ${fmtPct(ov.operatorReduction)}（${ov.operatorsBaseline} → ${ov.operatorsOptimized}）。`;
  },
  quality_pass_rate: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前首件合格率 ${fmtPct(ov.qualityPassRate)}。`;
  },
  exception_rate: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `异常事件占比 ${fmtPct(ov.exceptionRate)}（${ov.totalEvents} 次换产中）。`;
  },
  scheduling_accuracy: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `调度准确率 ${fmtPct(ov.schedulingAccuracy)}。`;
  },
  time_span_days: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `覆盖 ${ov.timeSpanDays} 天，${ov.totalEvents} 次换产。`;
  },
  product_count: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 ${ov.productCount} 种产品型号。`;
  },
  material_count: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 ${ov.materialCount} 个物料 SKU。`;
  },
  equipment_count: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 ${ov.equipmentCount} 台套设备。`;
  },
  tooling_count: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 ${ov.toolingCount} 套工装夹具。`;
  },
  operator_count: (ctx) => {
    const ov = o(ctx);
    if (!ov) return null;
    return `当前 ${ov.operatorCount} 名作业人员。`;
  },
  makespan: (ctx) => {
    const recs = rs(ctx);
    if (recs.length < 2) return null;
    const head = avg(recs.slice(0, Math.min(10, recs.length)).map((r) => r.makespan));
    const tail = avg(recs.slice(-10).map((r) => r.makespan));
    return `前 10 次平均 ${fmtMin(head)}，近 10 次 ${fmtMin(tail)}，下降 ${fmtPct(((head - tail) / head) * 100)}。`;
  },
  parallelism: (ctx) => {
    const recs = rs(ctx);
    if (recs.length === 0) return null;
    const avgP = avg(recs.map((r) => r.parallelism));
    const l = last(ctx);
    return `全程平均并行度 ${avgP.toFixed(2)}；最近一次 ${l ? l.parallelism.toFixed(2) : '-'}。`;
  },
  learning_accuracy: (ctx) => {
    const recs = rs(ctx);
    if (recs.length === 0) return null;
    const l = last(ctx);
    const a = avg(recs.map((r) => r.accuracy));
    return `全程平均 ${fmtPct(a * 100)}；最近一次 ${l ? fmtPct(l.accuracy * 100) : '-'}。`;
  },
  pre_load_ratio: (ctx) => {
    const l = last(ctx);
    if (!l) return null;
    return `最新值 ${l.params.preLoadRatio.toFixed(2)}，${l.params.preLoadRatio > 0.5 ? '已偏向充分预置' : '保守预置'}。`;
  },
  parallel_threshold: (ctx) => {
    const l = last(ctx);
    if (!l) return null;
    return `最新阈值 ${l.params.parallelThreshold}，允许 ${l.params.parallelThreshold} 路并行任务。`;
  },
  operator_flexibility: (ctx) => {
    const l = last(ctx);
    if (!l) return null;
    return `最新柔性 ${l.params.operatorFlexibility.toFixed(2)}，${l.params.operatorFlexibility > 0.5 ? '高' : '低'} 人员互换度。`;
  },
  agv_count: (ctx) => {
    const l = last(ctx);
    if (!l) return null;
    return `最新 AGV 数量 ${l.params.agvCount} 台。`;
  },
  inspection_buffer: (ctx) => {
    const l = last(ctx);
    if (!l) return null;
    return `最新首件检验缓冲 ${l.params.inspectionBuffer} 分钟。`;
  },
  material_lead_seconds: (ctx) => {
    const l = last(ctx);
    if (!l) return null;
    return `最新物料提前到位 ${l.params.materialLeadSeconds} 秒。`;
  },
};

export function formatDynamic(key: string, ctx: DynamicContext): string | null {
  const fn = dynamicFormatters[key];
  if (!fn) return null;
  try {
    return fn(ctx);
  } catch {
    return null;
  }
}
