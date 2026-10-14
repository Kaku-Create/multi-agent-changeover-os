export type AgentType =
  | 'scheduling'
  | 'equipment'
  | 'material'
  | 'tooling'
  | 'quality'
  | 'employee';

export type AgentStatus = 'idle' | 'perceiving' | 'reasoning' | 'executing' | 'waiting' | 'alerting';

export type OperatorRole = '设备工程师' | '操作工' | '质检员' | '物料员';

export type SkillLevel = '初级' | '中级' | '高级';

export type EquipmentType =
  | 'SMT贴片机'
  | '锡膏印刷机'
  | '回流焊炉'
  | 'AOI检测机'
  | 'SPI检测机'
  | '波峰焊';

export type EquipmentStatus = 'idle' | 'running' | 'changeover' | 'fault' | 'maintenance';

export type ToolingStatus = 'in_place' | 'pending' | 'installing' | 'inspecting' | 'ready';

export type ChangeoverStepKey =
  | 'line_clear'
  | 'program_switch'
  | 'parameter_tune'
  | 'material_prepare'
  | 'material_delivery'
  | 'tooling_switch'
  | 'first_article'
  | 'resume';

export interface Product {
  code: string;
  name: string;
  faces: string[];
  quantity: number;
  materialCount: number;
  totalComponents: number;
  batches: string[];
  route: string[];
  baseChangeoverMinutes: number;
  complexity: number;
}

export interface Material {
  sku: string;
  name: string;
  category: string;
  stock: number;
  safetyStock: number;
  location: string;
  leadTimeMinutes: number;
}

export interface BomItem {
  sku: string;
  name: string;
  qty: number;
  face: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  currentProduct: string | null;
  line: string;
  oee: number;
  utilization: number;
  temperature?: number;
  program?: string;
}

export interface Tooling {
  id: string;
  name: string;
  type: string;
  forProduct: string;
  status: ToolingStatus;
  installMinutes: number;
  line: string;
}

export interface Operator {
  id: string;
  name: string;
  role: OperatorRole;
  skill: SkillLevel;
  shift: string;
  status: 'idle' | 'working' | 'moving' | 'break';
  currentTask: string | null;
  efficiency: number;
}

export interface ChangeoverTask {
  id: string;
  step: ChangeoverStepKey;
  name: string;
  agent: AgentType;
  duration: number;
  estimatedDuration: number;
  start: number;
  end: number;
  status: 'pending' | 'running' | 'done' | 'delayed' | 'failed';
  dependsOn: ChangeoverStepKey[];
  resource: string;
  requiredRole?: OperatorRole;
  parallelizable: boolean;
  isCritical: boolean;
}

export interface SchedulePlan {
  name: string;
  tasks: ChangeoverTask[];
  makespan: number;
  criticalPath: ChangeoverStepKey[];
  parallelism: number;
  operatorCount: number;
  resourceUtilization: number;
}

export interface ExceptionScenario {
  id: string;
  name: string;
  type:
    | 'normal'
    | 'agv_delay'
    | 'material_shortage'
    | 'equipment_alarm'
    | 'quality_fail'
    | 'staff_absence';
  probability: number;
  description: string;
}

export interface AgentMessage {
  id: string;
  timestamp: number;
  from: AgentType;
  to: AgentType | 'broadcast';
  kind: 'perceive' | 'propose' | 'assign' | 'confirm' | 'alert' | 'resolve' | 'learn';
  content: string;
  payload?: Record<string, unknown>;
}

export interface AgentState {
  type: AgentType;
  name: string;
  status: AgentStatus;
  currentTask: string | null;
  load: number;
  decisionCount: number;
  successCount: number;
  alertCount: number;
  lastAction: string;
  capabilities: string[];
}

export interface ChangeoverEvent {
  id: string;
  sequence: number;
  line: string;
  day: number;
  fromProduct: string;
  toProduct: string;
  plannedStartMinute: number;
  scenario: ExceptionScenario['type'];
  schedule: SchedulePlan;
  baselineMinutes: number;
  actualMinutes: number;
  savedMinutes: number;
  savedRatio: number;
  oeeBefore: number;
  oeeAfter: number;
  operatorsBaseline: number;
  operatorsOptimized: number;
  success: boolean;
  qualityPassed: boolean;
  bottleneck: string;
  messages: AgentMessage[];
  timeline: TaskExecution[];
  deviations: Deviation[];
}

export interface TaskExecution {
  taskId: string;
  name: string;
  agent: AgentType;
  start: number;
  end: number;
  baselineStart: number;
  baselineEnd: number;
  status: string;
  operator?: string;
}

export interface Deviation {
  at: number;
  taskId: string;
  description: string;
  deltaMinutes: number;
  resolved: boolean;
  resolution: string;
}

export interface LearningRecord {
  sequence: number;
  day: number;
  makespan: number;
  parallelism: number;
  accuracy: number;
  params: StrategyParams;
}

export interface StrategyParams {
  parallelThreshold: number;
  materialLeadSeconds: number;
  inspectionBuffer: number;
  agvCount: number;
  preLoadRatio: number;
  operatorFlexibility: number;
}

export interface OverviewMetrics {
  totalEvents: number;
  avgChangeoverMinutes: number;
  baselineChangeoverMinutes: number;
  targetChangeoverMinutes: [number, number];
  reductionRatio: number;
  oee: number;
  baselineOee: number;
  operatorsBaseline: number;
  operatorsOptimized: number;
  operatorReduction: number;
  qualityPassRate: number;
  exceptionRate: number;
  schedulingAccuracy: number;
}

export interface SimulationDataset {
  products: Product[];
  materials: Material[];
  equipment: Equipment[];
  toolings: Tooling[];
  operators: Operator[];
  events: ChangeoverEvent[];
  learning: LearningRecord[];
  scenarios: ExceptionScenario[];
  overview: OverviewMetrics;
  generatedAt: string;
  timeSpanDays: number;
}
