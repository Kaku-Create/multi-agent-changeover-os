import type { Equipment, Material, Operator, Product } from '../domain/types.js';
import { pick, pickNum } from '../lib/parsers.js';

export interface ImportResult<T> {
  items: T[];
  total: number;
  errors: { row: number; message: string }[];
}

export interface WorkorderRow {
  row: number;
  fromProduct: string;
  toProduct: string;
  scenario: string;
  line?: string;
  day?: number;
  plannedStartMinute?: number;
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const MATERIAL_CATEGORIES = [
  '片式电阻', '片式电容', '功率二极管', 'LED', '芯片类',
  '小信号二极管/稳压管/TVS', '三极管/MOSFET', '电解电容',
  '电感/磁珠', '连接器/开关/继电器', '晶振', '保护/滤波/其他',
];

const EQUIPMENT_TYPES = ['SMT贴片机', '锡膏印刷机', '回流焊炉', 'AOI检测机', 'SPI检测机', '波峰焊'] as const;
const ROLES = ['设备工程师', '操作工', '质检员', '物料员'] as const;
const SKILLS = ['初级', '中级', '高级'] as const;
const SCENARIO_TYPES = ['normal', 'agv_delay', 'material_shortage', 'equipment_alarm', 'quality_fail', 'staff_absence'] as const;

function deriveComplexity(faces: number, totalComponents: number): number {
  return round(Math.min(1.18, Math.max(0.9, 0.9 + totalComponents / 2800 + (faces > 1 ? 0.05 : 0))), 2);
}

function deriveRoute(faces: number): string[] {
  const route = ['下线清线', '锡膏印刷', 'SPI锡膏检测', '高速贴片'];
  if (faces > 1) route.push('反面贴片');
  route.push('回流焊接', 'AOI光学检测', '首件检验', '恢复生产');
  return route;
}

function toProduct(input: {
  code: string; name?: string; faces: string[]; quantity: number;
  materialCount: number; totalComponents: number; batches: string[];
}): Product {
  const complexity = deriveComplexity(input.faces.length, input.totalComponents);
  return {
    code: input.code,
    name: input.name ?? `PCBA-${input.code}`,
    faces: input.faces.length ? input.faces : ['TOP'],
    quantity: input.quantity,
    materialCount: input.materialCount,
    totalComponents: input.totalComponents,
    batches: input.batches,
    route: deriveRoute(input.faces.length),
    baseChangeoverMinutes: round(22 + complexity * 8, 1),
    complexity,
  };
}

export function normalizeProducts(rows: Record<string, unknown>[]): ImportResult<Product> {
  const errors: { row: number; message: string }[] = [];
  const groups = new Map<string, {
    name?: string; faces: Set<string>; quantity: number;
    rows: number; totalComponents: number; batches: Set<string>;
  }>();

  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const code = pick(row, ['成品专用号', '产品编码', '产品型号', 'code', 'productCode']);
    if (!code) {
      errors.push({ row: rowNo, message: '缺少产品编码（成品专用号/code）' });
      return;
    }
    const face = pick(row, ['面', '工艺面', 'face']) ?? 'TOP';
    const qty = pickNum(row, ['排产数量', '数量', 'quantity', 'qty'], 0) ?? 0;
    const usage = pickNum(row, ['用量', '单机用量', 'usage', 'qtyPerUnit'], 0) ?? 0;
    const batch = pick(row, ['订单批次号', '批次号', 'batch']);
    const g = groups.get(code) ?? {
      name: pick(row, ['成品描述', '产品名称', 'name']),
      faces: new Set<string>(),
      quantity: qty,
      rows: 0,
      totalComponents: 0,
      batches: new Set<string>(),
    };
    g.faces.add(face);
    g.rows += 1;
    g.totalComponents += usage;
    if (batch) g.batches.add(batch);
    groups.set(code, g);
  });

  const items = [...groups.entries()].map(([code, g]) =>
    toProduct({
      code, name: g.name, faces: [...g.faces], quantity: g.quantity,
      materialCount: g.rows, totalComponents: g.totalComponents, batches: [...g.batches],
    }),
  );
  return { items, total: rows.length, errors };
}

export function normalizeMaterials(rows: Record<string, unknown>[]): ImportResult<Material> {
  const errors: { row: number; message: string }[] = [];
  const seen = new Map<string, Material>();
  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const sku = pick(row, ['物料编码', '物料号', 'sku', 'materialCode']);
    if (!sku) {
      errors.push({ row: rowNo, message: '缺少物料编码（物料编码/sku）' });
      return;
    }
    const name = pick(row, ['物料描述', '物料名称', 'name', 'description']) ?? sku;
    const category = pick(row, ['分类', '物料分类', 'category']) ??
      MATERIAL_CATEGORIES.find((c) => name.includes(c)) ?? '保护/滤波/其他';
    const stock = pickNum(row, ['库存', '库存数量', 'stock'], 0) ?? 0;
    const safetyStock = pickNum(row, ['安全库存', 'safetyStock'], Math.round(stock * 0.25)) ?? 0;
    seen.set(sku, {
      sku,
      name,
      category,
      stock,
      safetyStock,
      location: pick(row, ['库位', 'location']) ?? 'A1-01',
      leadTimeMinutes: pickNum(row, ['拣配时长', '提前期', 'leadTimeMinutes'], 5) ?? 5,
    });
  });
  return { items: [...seen.values()], total: rows.length, errors };
}

export function normalizeEquipment(rows: Record<string, unknown>[]): ImportResult<Equipment> {
  const errors: { row: number; message: string }[] = [];
  const seen = new Map<string, Equipment>();
  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const id = pick(row, ['设备编号', '设备id', 'id', 'equipmentId']);
    if (!id) {
      errors.push({ row: rowNo, message: '缺少设备编号（设备编号/id）' });
      return;
    }
    const rawType = pick(row, ['设备类型', '类型', 'type']) ?? 'SMT贴片机';
    const type = (EQUIPMENT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as Equipment['type'])
      : ('SMT贴片机' as Equipment['type']);
    seen.set(id, {
      id,
      name: pick(row, ['设备名称', 'name']) ?? id,
      type,
      status: 'idle',
      currentProduct: pick(row, ['当前产品', 'currentProduct']) ?? null,
      line: pick(row, ['产线', 'line']) ?? 'SMT-01',
      oee: pickNum(row, ['oee', 'OEE'], 70) ?? 70,
      utilization: pickNum(row, ['利用率', 'utilization'], 75) ?? 75,
      program: pick(row, ['程序号', 'program']) ?? undefined,
    });
  });
  return { items: [...seen.values()], total: rows.length, errors };
}

export function normalizeOperators(rows: Record<string, unknown>[]): ImportResult<Operator> {
  const errors: { row: number; message: string }[] = [];
  const seen = new Map<string, Operator>();
  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const id = pick(row, ['工号', '人员编号', 'id', 'operatorId']);
    if (!id) {
      errors.push({ row: rowNo, message: '缺少工号（工号/id）' });
      return;
    }
    const rawRole = pick(row, ['工种', '岗位', 'role']) ?? '操作工';
    const role = (ROLES as readonly string[]).includes(rawRole) ? (rawRole as Operator['role']) : '操作工';
    const rawSkill = pick(row, ['技能等级', '技能', 'skill']) ?? '中级';
    const skill = (SKILLS as readonly string[]).includes(rawSkill) ? (rawSkill as Operator['skill']) : '中级';
    seen.set(id, {
      id,
      name: pick(row, ['姓名', 'name']) ?? id,
      role,
      skill,
      shift: pick(row, ['班次', 'shift']) ?? '早班',
      status: 'idle',
      currentTask: null,
      efficiency: pickNum(row, ['效率系数', 'efficiency'], 1) ?? 1,
    });
  });
  return { items: [...seen.values()], total: rows.length, errors };
}

export function normalizeWorkorders(rows: Record<string, unknown>[]): ImportResult<WorkorderRow> {
  const errors: { row: number; message: string }[] = [];
  const items: WorkorderRow[] = [];
  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const fromProduct = pick(row, ['源产品', '换产前产品', 'fromProduct', 'from']);
    const toProduct = pick(row, ['目标产品', '换产后产品', 'toProduct', 'to', '成品专用号']);
    if (!fromProduct || !toProduct) {
      errors.push({ row: rowNo, message: '缺少源产品或目标产品（fromProduct/toProduct）' });
      return;
    }
    const rawScenario = pick(row, ['场景', '异常场景', 'scenario']) ?? 'normal';
    const scenario = (SCENARIO_TYPES as readonly string[]).includes(rawScenario) ? rawScenario : 'normal';
    items.push({
      row: rowNo,
      fromProduct,
      toProduct,
      scenario,
      line: pick(row, ['产线', 'line']),
      day: pickNum(row, ['天', 'day']),
      plannedStartMinute: pickNum(row, ['计划开始', 'plannedStartMinute']),
    });
  });
  return { items, total: rows.length, errors };
}

export function templateFor(kind: string): string {
  switch (kind) {
    case 'products':
      return '成品专用号,成品描述,面,排产数量,订单批次号,物料编码,物料描述,用量\n0044300864CB,pcb,TOP,400,4003111400,80014019000441,片式电阻,1';
    case 'materials':
      return '物料编码,物料描述,分类,库存,安全库存,库位,拣配时长\n80014019000441,片式电阻,片式电阻,500,120,A1-01,5';
    case 'equipment':
      return '设备编号,设备名称,设备类型,产线,当前产品,OEE,利用率\nSMT-01-CNC-1,SMT-01 贴片机,SMT贴片机,SMT-01,0044300864CB,72,80';
    case 'operators':
      return '工号,姓名,工种,技能等级,班次,效率系数\nOP-01,张伟,设备工程师,高级,早班,1.05';
    case 'workorders':
      return '源产品,目标产品,场景,产线,天,计划开始\n0044300864CB,0044300640P,normal,SMT-01,1,480';
    default:
      return '';
  }
}
