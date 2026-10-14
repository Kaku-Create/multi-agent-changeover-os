import realData from '../data/real-data.json' with { type: 'json' };
import type {
  AgentMessage,
  AgentType,
  ChangeoverEvent,
  ChangeoverStepKey,
  Deviation,
  Equipment,
  EquipmentType,
  ExceptionScenario,
  LearningRecord,
  Material,
  Operator,
  OverviewMetrics,
  Product,
  SimulationDataset,
  StrategyParams,
  TaskExecution,
  Tooling,
} from '../domain/types.js';
import { Rng, round } from './random.js';
import {
  scheduleChangeover,
  estimateOee,
  type ScheduleOptions,
} from './scheduler.js';
import { BASELINE_ORDER, TASK_TEMPLATES, type RoleCapacity } from './tasks.js';

type RawProduct = (typeof realData.products)[number];
type RawMaterial = (typeof realData.materials)[number];

const LINES = ['SMT-01', 'SMT-02', 'SMT-03'];
const EQUIPMENT_TYPES: EquipmentType[] = [
  '锡膏印刷机',
  'SPI检测机',
  'SMT贴片机',
  '回流焊炉',
  'AOI检测机',
  '波峰焊',
];
const ROUTE_BY_TYPE: Record<EquipmentType, string> = {
  锡膏印刷机: '锡膏印刷',
  SPI检测机: 'SPI锡膏检测',
  SMT贴片机: '高速贴片',
  回流焊炉: '回流焊接',
  AOI检测机: 'AOI光学检测',
  波峰焊: '波峰焊',
};
const LOCATIONS = ['A1-01', 'A1-02', 'B2-03', 'B2-04', 'C3-01', 'C3-02', 'D4-05', 'D4-06'];

export const SCENARIOS: ExceptionScenario[] = [
  { id: 'normal', name: '正常换产', type: 'normal', probability: 0.55, description: '各资源按最优时序协同，无异常。' },
  { id: 'agv_delay', name: 'AGV配送延迟', type: 'agv_delay', probability: 0.12, description: '物料AGV故障延迟约15分钟，需要重排时序避免无效等待。' },
  { id: 'material_shortage', name: '物料短缺', type: 'material_shortage', probability: 0.1, description: '线边物料低于安全库存，触发紧急拣配或替代料确认。' },
  { id: 'equipment_alarm', name: '设备报警', type: 'equipment_alarm', probability: 0.1, description: '贴片机/回流焊出现报警，需要重校准或切换备用设备。' },
  { id: 'quality_fail', name: '首件不合格', type: 'quality_fail', probability: 0.08, description: '首件检测不合格，触发返工与二次检验。' },
  { id: 'staff_absence', name: '人员缺勤', type: 'staff_absence', probability: 0.05, description: '关键工种临时缺勤，需要多技能人员顶岗。' },
];

function buildProducts(rng: Rng): Product[] {
  return (realData.products as RawProduct[]).map((p) => {
    const complexity = round(
      Math.min(1.18, Math.max(0.9, 0.9 + p.totalComponents / 2800 + (p.faces.length > 1 ? 0.05 : 0))),
      2,
    );
    const route: string[] = ['下线清线', '锡膏印刷', 'SPI锡膏检测', '高速贴片'];
    if (p.faces.includes('BOT')) route.push('反面贴片');
    route.push('回流焊接', 'AOI光学检测', '首件检验', '恢复生产');
    return {
      code: p.code,
      name: p.name,
      faces: p.faces,
      quantity: p.quantity,
      materialCount: p.materialCount,
      totalComponents: p.totalComponents,
      batches: p.batches,
      route,
      baseChangeoverMinutes: round(22 + complexity * 8 + rng.range(-1.5, 1.5), 1),
      complexity,
    };
  });
}

function buildMaterials(rng: Rng): Material[] {
  return (realData.materials as RawMaterial[]).map((m, i) => {
    const stock = rng.int(40, 1200);
    return {
      sku: m.sku,
      name: m.name,
      category: m.category,
      stock,
      safetyStock: Math.round(stock * rng.range(0.15, 0.35)),
      location: LOCATIONS[i % LOCATIONS.length],
      leadTimeMinutes: rng.int(3, 18),
    };
  });
}

function buildEquipment(products: Product[]): Equipment[] {
  const list: Equipment[] = [];
  LINES.forEach((line, li) => {
    EQUIPMENT_TYPES.forEach((type, ti) => {
      const count = type === 'SMT贴片机' ? 2 : 1;
      for (let c = 0; c < count; c++) {
        list.push({
          id: `${line}-${type}-${c + 1}`,
          name: `${line} ${type}${count > 1 ? ` #${c + 1}` : ''}`,
          type,
          status: 'running',
          currentProduct: products[(li * 7 + ti + c) % products.length].code,
          line,
          oee: round(68 + ((li + ti + c) % 9), 1),
          utilization: round(72 + ((li * 3 + ti) % 18), 1),
          temperature: type === '回流焊炉' ? round(235 + (ti % 5), 1) : undefined,
          program: `PRG-${(li * 13 + ti) % 40}`,
        });
      }
    });
  });
  return list;
}

function buildToolings(products: Product[], rng: Rng): Tooling[] {
  const list: Tooling[] = [];
  products.slice(0, 40).forEach((p, i) => {
    const count = p.faces.length > 1 ? 2 : 1;
    for (let c = 0; c < count; c++) {
      list.push({
        id: `TL-${String(i * 2 + c + 1).padStart(3, '0')}`,
        name: `${p.code} ${c === 0 ? '载具' : '钢网'}夹具`,
        type: c === 0 ? '载具' : '钢网',
        forProduct: p.code,
        status: rng.pick(['in_place', 'pending', 'installing', 'inspecting', 'ready'] as const),
        installMinutes: round(rng.range(3.5, 7), 1),
        line: LINES[i % LINES.length],
      });
    }
  });
  return list;
}

function buildOperators(rng: Rng): Operator[] {
  const names = [
    '张伟', '李娜', '王强', '刘敏', '陈杰', '杨帆',
    '赵磊', '黄婷', '周军', '吴迪', '徐涛', '孙丽',
  ];
  const roles: Operator['role'][] = [
    '设备工程师', '设备工程师', '操作工', '操作工', '操作工',
    '操作工', '质检员', '质检员', '物料员', '物料员',
    '设备工程师', '操作工',
  ];
  const shifts = ['早班', '中班', '晚班'];
  return names.map((name, i) => ({
    id: `OP-${String(i + 1).padStart(2, '0')}`,
    name,
    role: roles[i],
    skill: i < 3 ? '高级' : i < 8 ? '中级' : '初级',
    shift: shifts[i % shifts.length],
    status: rng.pick(['idle', 'working', 'moving', 'break'] as const),
    currentTask: null,
    efficiency: round(rng.range(0.85, 1.15), 2),
  }));
}

const BASE_DURATIONS: Record<ChangeoverStepKey, number> = {
  line_clear: 3.5,
  program_switch: 3.0,
  parameter_tune: 4.0,
  material_prepare: 4.5,
  material_delivery: 3.5,
  tooling_switch: 5.0,
  first_article: 5.0,
  resume: 1.5,
};

interface DurationContext {
  complexity: number;
  params: StrategyParams;
  rng: Rng;
  scenario: ExceptionScenario['type'];
}

function computeDurations(ctx: DurationContext): {
  optimized: Record<ChangeoverStepKey, number>;
  baseline: Record<ChangeoverStepKey, number>;
} {
  const { complexity, params, rng } = ctx;
  const noise = () => rng.range(0.94, 1.08);
  const eff = 1 - params.operatorFlexibility * 0.1 - params.preLoadRatio * 0.06;
  const optimized = {} as Record<ChangeoverStepKey, number>;
  const baseline = {} as Record<ChangeoverStepKey, number>;
  (Object.keys(BASE_DURATIONS) as ChangeoverStepKey[]).forEach((key) => {
    let base = BASE_DURATIONS[key] * complexity;
    if (key === 'material_prepare') base *= 1 - params.preLoadRatio * 0.45;
    if (key === 'material_delivery') base *= 1 - params.preLoadRatio * 0.2;
    if (key === 'first_article') base *= 1 + params.inspectionBuffer;
    if (key === 'tooling_switch') base *= 1 - params.parallelThreshold * 0.08;
    optimized[key] = Math.max(0.6, round(base * eff * noise(), 2));
    baseline[key] = Math.max(0.6, round(BASE_DURATIONS[key] * rng.range(0.97, 1.08), 2));
  });
  return { optimized, baseline };
}

const OPT_CAPACITIES: RoleCapacity = { 设备工程师: 2, 操作工: 3, 质检员: 1, 物料员: 2 };
const BASELINE_CAPACITIES: RoleCapacity = { 设备工程师: 3, 操作工: 4, 质检员: 1, 物料员: 2 };

function buildMessages(
  event: ChangeoverEvent,
  equipment: Equipment[],
  rng: Rng,
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  let t = 0;
  const push = (
    from: AgentType,
    to: AgentType | 'broadcast',
    kind: AgentMessage['kind'],
    content: string,
    payload?: Record<string, unknown>,
  ) => {
    t += round(rng.range(0.4, 1.4), 2);
    messages.push({ id: `${event.id}-M${messages.length + 1}`, timestamp: round(t, 2), from, to, kind, content, payload });
  };

  push('scheduling', 'broadcast', 'perceive',
    `接收MES换产指令：${event.fromProduct} → ${event.toProduct}（${event.line}），启动多智能体协同编排。`,
    { from: event.fromProduct, to: event.toProduct, line: event.line });
  push('equipment', 'scheduling', 'propose',
    `设备状态感知完成，${equipment.length > 0 ? equipment[0].name : '产线'}可用，预置程序方案已就绪。`);
  push('material', 'scheduling', 'propose',
    `物料需求分析：本次换产涉及${rng.int(18, 42)}种物料，库存校核完成。`);
  push('tooling', 'scheduling', 'propose', `工装夹具选型完成，拆装工序预计${round(rng.range(4, 6), 1)}分钟。`);
  push('employee', 'scheduling', 'propose', '人员排班就绪，多技能顶岗人员已待命。');
  push('scheduling', 'broadcast', 'assign',
    `生成最优时序：并行执行设备调参/物料配送/工装切换，首件检验作为汇聚节点，预计换产${event.schedule.makespan}分钟。`,
    { criticalPath: event.schedule.criticalPath, makespan: event.schedule.makespan });

  if (event.scenario !== 'normal') {
    const scenario = SCENARIOS.find((s) => s.type === event.scenario)!;
    const fromAgent: AgentType = scenario.type === 'agv_delay' || scenario.type === 'material_shortage'
      ? 'material'
      : scenario.type === 'equipment_alarm'
        ? 'equipment'
        : scenario.type === 'quality_fail'
          ? 'quality'
          : 'employee';
    push(fromAgent, 'broadcast', 'alert', `异常告警：${scenario.name}。${scenario.description}`);
    push('scheduling', fromAgent, 'resolve',
      `动态重排已触发：调整任务优先级与资源占用，将异常影响降至最低并保持关键路径连续。`);
  }

  const qualityNg = event.scenario === 'quality_fail' || !event.qualityPassed;
  push('quality', 'scheduling', 'confirm',
    qualityNg
      ? '首件检验判定不合格，触发返工与二次检验流程。'
      : '首件检验合格，关键尺寸/外观/功能判定通过。');
  push('scheduling', 'broadcast', 'assign',
    `换产完成确认，实际用时${event.actualMinutes}分钟，较传统模式节省${event.savedMinutes}分钟。`,
    { actualMinutes: event.actualMinutes, savedMinutes: event.savedMinutes });
  push('scheduling', 'broadcast', 'learn',
    `复盘本轮换产，瓶颈为「${event.bottleneck}」，已更新策略参数并沉淀复用模板。`,
    { bottleneck: event.bottleneck, params: event.actualMinutes });
  return messages;
}

function buildDeviations(
  event: ChangeoverEvent,
  rng: Rng,
): Deviation[] {
  if (event.scenario === 'normal') return [];
  const scenario = SCENARIOS.find((s) => s.type === event.scenario)!;
  const target: Record<ExceptionScenario['type'], ChangeoverStepKey | null> = {
    normal: null,
    agv_delay: 'material_delivery',
    material_shortage: 'material_prepare',
    equipment_alarm: 'parameter_tune',
    quality_fail: 'first_article',
    staff_absence: 'line_clear',
  };
  const key = target[event.scenario];
  const task = event.schedule.tasks.find((t) => t.step === key);
  const rawDelay: Record<ExceptionScenario['type'], number> = {
    normal: 0,
    agv_delay: rng.range(13, 17),
    material_shortage: rng.range(5, 9),
    equipment_alarm: rng.range(6, 11),
    quality_fail: rng.range(5, 8),
    staff_absence: rng.range(3, 6),
  };
  const detected = round(rawDelay[event.scenario], 1);
  const residual = round(detected * rng.range(0.15, 0.35), 1);
  return [
    {
      at: task ? task.start : 0,
      taskId: task?.id ?? 'T1',
      description: `${scenario.name}：${task?.name ?? '换产任务'}检测到偏差`,
      deltaMinutes: detected,
      resolved: true,
      resolution: `调度智能体重排优先级，补偿后残余偏差约${residual}分钟`,
    },
  ];
}

function pickProducts(products: Product[], rng: Rng): { from: Product; to: Product } {
  const from = rng.pick(products);
  let to = rng.pick(products);
  let guard = 0;
  while (to.code === from.code && guard < 20) {
    to = rng.pick(products);
    guard += 1;
  }
  return { from, to };
}

export function generateDataset(seed = 20261002): SimulationDataset {
  const rng = new Rng(seed);
  const products = buildProducts(rng);
  const materials = buildMaterials(rng);
  const equipment = buildEquipment(products);
  const toolings = buildToolings(products, rng);
  const operators = buildOperators(rng);

  const params: StrategyParams = {
    parallelThreshold: 0.35,
    materialLeadSeconds: 60,
    inspectionBuffer: 0.08,
    agvCount: 1,
    preLoadRatio: 0.25,
    operatorFlexibility: 0.4,
  };

  const events: ChangeoverEvent[] = [];
  const learning: LearningRecord[] = [];
  const TOTAL_DAYS = 30;
  const TOTAL_EVENTS = 64;

  for (let i = 0; i < TOTAL_EVENTS; i++) {
    const day = Math.min(TOTAL_DAYS, Math.floor((i / TOTAL_EVENTS) * TOTAL_DAYS) + 1);
    const { from, to } = pickProducts(products, rng);
    const scenario = weightedScenario(rng);
    const durations = computeDurations({ complexity: to.complexity, params, rng, scenario: scenario.type });

    const baselineResult = scheduleChangeover({
      parallel: false,
      capacities: BASELINE_CAPACITIES,
      agvCount: 1,
      durations: durations.baseline,
    });

    const optimizedResult = scheduleChangeover({
      parallel: true,
      capacities: OPT_CAPACITIES,
      agvCount: Math.round(params.agvCount),
      durations: durations.optimized,
    });

    const eventId = `CE-${String(i + 1).padStart(3, '0')}`;
    const line = LINES[i % LINES.length];
    const qualityFailed = scenario.type === 'quality_fail';
    const plan = {
      name: `${from.code} → ${to.code}`,
      tasks: optimizedResult.tasks,
      makespan: optimizedResult.makespan,
      criticalPath: optimizedResult.criticalPath,
      parallelism: optimizedResult.parallelism,
      operatorCount: 8,
      resourceUtilization: round(rng.range(0.72, 0.9), 2),
    };

    const baseMakespan = baselineResult.makespan;
    const scenarioPenaltyBaseline = scenarioPenalty(scenario.type, rng);
    const optimizedPenalty = scenarioPenaltyOptimized(scenario.type, rng);
    const baselineMinutes = round(baseMakespan + scenarioPenaltyBaseline, 1);
    const actualMinutes = round(optimizedResult.makespan + optimizedPenalty, 1);
    const savedMinutes = round(baselineMinutes - actualMinutes, 1);

    const bottleneckTask = optimizedResult.tasks.reduce(
      (max, t) => (t.duration > max.duration ? t : max),
      optimizedResult.tasks[0],
    );
    const qualityPassed = scenario.type === 'quality_fail' ? rng.chance(0.55) : rng.chance(0.98) ;

    const event: ChangeoverEvent = {
      id: eventId,
      sequence: i + 1,
      line,
      day,
      fromProduct: from.code,
      toProduct: to.code,
      plannedStartMinute: (i % 2 === 0 ? 8 : 14) * 60 + rng.int(0, 40),
      scenario: scenario.type,
      schedule: plan,
      baselineMinutes,
      actualMinutes,
      savedMinutes,
      savedRatio: round((savedMinutes / baselineMinutes) * 100, 1),
      oeeBefore: estimateOee(baselineMinutes, true),
      oeeAfter: estimateOee(actualMinutes, qualityPassed),
      operatorsBaseline: 10,
      operatorsOptimized: 8,
      success: actualMinutes <= 20,
      qualityPassed,
      bottleneck: bottleneckTask?.name ?? '首件检验',
      messages: [],
      timeline: [],
      deviations: [],
    };

    const baselineTimeline: TaskExecution[] = baselineResult.tasks.map((t) => ({
      taskId: `B-${t.step}`,
      name: t.name,
      agent: t.agent,
      start: t.start,
      end: t.end,
      baselineStart: t.start,
      baselineEnd: t.end,
      status: 'done',
    }));
    const optimizedTimeline: TaskExecution[] = optimizedResult.tasks.map((t) => {
      const bt = baselineResult.tasks.find((b) => b.step === t.step);
      return {
        taskId: t.id,
        name: t.name,
        agent: t.agent,
        start: t.start,
        end: t.end,
        baselineStart: bt?.start ?? 0,
        baselineEnd: bt?.end ?? 0,
        status: t.isCritical ? 'critical' : 'done',
      };
    });
    event.timeline = [...baselineTimeline, ...optimizedTimeline];
    event.messages = buildMessages(event, equipment.slice(0, 2), rng);
    event.deviations = buildDeviations(event, rng);

    events.push(event);

    const accuracy = round(rng.range(0.88, 0.97) + (i / TOTAL_EVENTS) * 0.03, 3);
    learning.push({
      sequence: i + 1,
      day,
      makespan: actualMinutes,
      parallelism: plan.parallelism,
      accuracy: Math.min(0.99, accuracy),
      params: { ...params },
    });

    params.preLoadRatio = Math.min(0.62, params.preLoadRatio + (actualMinutes > 17 ? 0.012 : 0.02));
    params.parallelThreshold = Math.min(0.85, params.parallelThreshold + 0.014);
    params.operatorFlexibility = Math.min(0.85, params.operatorFlexibility + 0.012);
    params.agvCount = Math.min(3, params.agvCount + (i % 7 === 0 ? 0.34 : 0.18));
    params.inspectionBuffer = Math.max(0.02, params.inspectionBuffer - 0.004);
  }

  const overview = computeOverview(events, learning);
  return {
    products,
    materials,
    equipment,
    toolings,
    operators,
    events,
    learning,
    scenarios: SCENARIOS,
    overview,
    generatedAt: new Date().toISOString(),
    timeSpanDays: TOTAL_DAYS,
  };
}

export interface SimulateOptions {
  from?: string;
  to?: string;
  scenario?: ExceptionScenario['type'];
  seed?: number;
  speed?: number;
}

export interface AssembleInput {
  from: Product;
  to: Product;
  scenario: ExceptionScenario;
  rng: Rng;
  equipment: Equipment[];
  params?: StrategyParams;
  id?: string;
  sequence?: number;
  day?: number;
  line?: string;
  plannedStartMinute?: number;
}

const DEFAULT_PARAMS: StrategyParams = {
  parallelThreshold: 0.62,
  materialLeadSeconds: 60,
  inspectionBuffer: 0.03,
  agvCount: 2.4,
  preLoadRatio: 0.6,
  operatorFlexibility: 0.8,
};

export function assembleEvent(input: AssembleInput): ChangeoverEvent {
  const { from, to, scenario, rng } = input;
  const equipment = input.equipment;
  const params = input.params ?? DEFAULT_PARAMS;

  const durations = computeDurations({ complexity: to.complexity, params, rng, scenario: scenario.type });
  const baselineResult = scheduleChangeover({
    parallel: false, capacities: BASELINE_CAPACITIES, agvCount: 1, durations: durations.baseline,
  });
  const optimizedResult = scheduleChangeover({
    parallel: true, capacities: OPT_CAPACITIES, agvCount: Math.round(params.agvCount), durations: durations.optimized,
  });

  const line = input.line ?? rng.pick(LINES);
  const qualityFailed = scenario.type === 'quality_fail';
  const qualityPassed = qualityFailed ? rng.chance(0.55) : true;
  const bottleneckTask = optimizedResult.tasks.reduce((max, t) => (t.duration > max.duration ? t : max), optimizedResult.tasks[0]);

  const plan = {
    name: `${from.code} → ${to.code}`,
    tasks: optimizedResult.tasks,
    makespan: optimizedResult.makespan,
    criticalPath: optimizedResult.criticalPath,
    parallelism: optimizedResult.parallelism,
    operatorCount: 8,
    resourceUtilization: round(rng.range(0.72, 0.9), 2),
  };
  const baselineMinutes = round(baselineResult.makespan + scenarioPenalty(scenario.type, rng), 1);
  const actualMinutes = round(optimizedResult.makespan + scenarioPenaltyOptimized(scenario.type, rng), 1);

  const event: ChangeoverEvent = {
    id: input.id ?? `LIVE-${Math.floor(rng.next() * 1e8)}`,
    sequence: input.sequence ?? 0,
    line,
    day: input.day ?? 0,
    fromProduct: from.code,
    toProduct: to.code,
    plannedStartMinute: input.plannedStartMinute ?? 8 * 60,
    scenario: scenario.type,
    schedule: plan,
    baselineMinutes,
    actualMinutes,
    savedMinutes: round(baselineMinutes - actualMinutes, 1),
    savedRatio: round(((baselineMinutes - actualMinutes) / baselineMinutes) * 100, 1),
    oeeBefore: estimateOee(baselineMinutes, true),
    oeeAfter: estimateOee(actualMinutes, qualityPassed),
    operatorsBaseline: 10,
    operatorsOptimized: 8,
    success: actualMinutes <= 20,
    qualityPassed,
    bottleneck: bottleneckTask?.name ?? '首件检验',
    messages: [],
    timeline: [],
    deviations: [],
  };
  event.timeline = optimizedResult.tasks.map((t) => {
    const bt = baselineResult.tasks.find((b) => b.step === t.step);
    return {
      taskId: t.id, name: t.name, agent: t.agent, start: t.start, end: t.end,
      baselineStart: bt?.start ?? 0, baselineEnd: bt?.end ?? 0,
      status: t.isCritical ? 'critical' : 'done',
    };
  });
  event.messages = buildMessages(event, equipment.slice(0, 2), rng);
  event.deviations = buildDeviations(event, rng);
  return event;
}

export function simulateSingle(options: SimulateOptions = {}): ChangeoverEvent {
  const seed = options.seed ?? Math.floor(Date.now() % 100000);
  const rng = new Rng(seed);
  const products = buildProducts(rng);
  const equipment = buildEquipment(products);
  const from = options.from ? products.find((p) => p.code === options.from) ?? rng.pick(products) : rng.pick(products);
  let to = options.to ? products.find((p) => p.code === options.to) ?? rng.pick(products) : rng.pick(products);
  if (to.code === from.code) to = products.find((p) => p.code !== from.code)!;
  const scenario = options.scenario
    ? SCENARIOS.find((s) => s.type === options.scenario) ?? SCENARIOS[0]
    : weightedScenario(rng);
  return assembleEvent({ from, to, scenario, rng, equipment, id: `LIVE-${seed}` });
}

export function findScenario(type: ExceptionScenario['type']): ExceptionScenario {
  return SCENARIOS.find((s) => s.type === type) ?? SCENARIOS[0];
}

function weightedScenario(rng: Rng): ExceptionScenario {
  const r = rng.next();
  let acc = 0;
  for (const s of SCENARIOS) {
    acc += s.probability;
    if (r <= acc) return s;
  }
  return SCENARIOS[0];
}

function scenarioPenalty(type: ExceptionScenario['type'], rng: Rng): number {
  switch (type) {
    case 'normal': return rng.range(0, 0.6);
    case 'agv_delay': return rng.range(6, 8.5);
    case 'material_shortage': return rng.range(2, 3.5);
    case 'equipment_alarm': return rng.range(2.5, 4);
    case 'quality_fail': return rng.range(2.5, 4);
    case 'staff_absence': return rng.range(1, 2.5);
  }
}

function scenarioPenaltyOptimized(type: ExceptionScenario['type'], rng: Rng): number {
  switch (type) {
    case 'normal': return rng.range(0, 0.6);
    case 'agv_delay': return rng.range(1.5, 3.2);
    case 'material_shortage': return rng.range(2, 4);
    case 'equipment_alarm': return rng.range(2, 4.5);
    case 'quality_fail': return rng.range(3, 5);
    case 'staff_absence': return rng.range(1, 2.5);
  }
}

export function computeOverview(events: ChangeoverEvent[], learning: LearningRecord[]): OverviewMetrics {
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const actual = avg(events.map((e) => e.actualMinutes));
  const baseline = avg(events.map((e) => e.baselineMinutes));
  const oee = avg(events.map((e) => e.oeeAfter));
  const baselineOee = avg(events.map((e) => e.oeeBefore));
  const qualityPassRate = (events.filter((e) => e.qualityPassed).length / events.length) * 100;
  const exceptionRate = (events.filter((e) => e.scenario !== 'normal').length / events.length) * 100;
  return {
    totalEvents: events.length,
    avgChangeoverMinutes: round(actual, 1),
    baselineChangeoverMinutes: round(baseline, 1),
    targetChangeoverMinutes: [15, 18],
    reductionRatio: round(((baseline - actual) / baseline) * 100, 1),
    oee: round(oee, 1),
    baselineOee: round(baselineOee, 1),
    operatorsBaseline: 10,
    operatorsOptimized: 8,
    operatorReduction: 20,
    qualityPassRate: round(qualityPassRate, 1),
    exceptionRate: round(exceptionRate, 1),
    schedulingAccuracy: round(avg(learning.map((l) => l.accuracy)) * 100, 1),
  };
}

export { BASELINE_ORDER, TASK_TEMPLATES };
