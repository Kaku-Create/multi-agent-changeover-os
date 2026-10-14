export type AgentType =
  | 'scheduling'
  | 'equipment'
  | 'material'
  | 'tooling'
  | 'quality'
  | 'employee';

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
  timeSpanDays: number;
  productCount: number;
  materialCount: number;
  equipmentCount: number;
  toolingCount: number;
  operatorCount: number;
}

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

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: string;
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
  status: string;
  installMinutes: number;
  line: string;
}

export interface Operator {
  id: string;
  name: string;
  role: string;
  skill: string;
  shift: string;
  status: string;
  currentTask: string | null;
  efficiency: number;
}

export interface ChangeoverTask {
  id: string;
  step: string;
  name: string;
  agent: AgentType;
  duration: number;
  start: number;
  end: number;
  status: string;
  resource: string;
  requiredRole?: string;
  isCritical: boolean;
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
}

export interface AgentMessage {
  id: string;
  timestamp: number;
  from: AgentType;
  to: AgentType | 'broadcast';
  kind: string;
  content: string;
}

export interface Deviation {
  at: number;
  taskId: string;
  description: string;
  deltaMinutes: number;
  resolved: boolean;
  resolution: string;
}

export interface ChangeoverEvent {
  id: string;
  sequence: number;
  line: string;
  day: number;
  fromProduct: string;
  toProduct: string;
  plannedStartMinute: number;
  scenario: string;
  schedule: {
    name: string;
    tasks: ChangeoverTask[];
    makespan: number;
    criticalPath: string[];
    parallelism: number;
    operatorCount: number;
    resourceUtilization: number;
  };
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

export interface EventSummary {
  id: string;
  sequence: number;
  day: number;
  line: string;
  fromProduct: string;
  toProduct: string;
  scenario: string;
  baselineMinutes: number;
  actualMinutes: number;
  savedMinutes: number;
  savedRatio: number;
  oeeBefore: number;
  oeeAfter: number;
  success: boolean;
  qualityPassed: boolean;
  bottleneck: string;
  parallelism: number;
}

export interface AgentState {
  type: AgentType;
  name: string;
  status: string;
  currentTask: string | null;
  load: number;
  decisionCount: number;
  successCount: number;
  alertCount: number;
  lastAction: string;
  capabilities: string[];
}

export interface LearningRecord {
  sequence: number;
  day: number;
  makespan: number;
  parallelism: number;
  accuracy: number;
  params: {
    parallelThreshold: number;
    materialLeadSeconds: number;
    inspectionBuffer: number;
    agvCount: number;
    preLoadRatio: number;
    operatorFlexibility: number;
  };
}

export interface Scenario {
  id: string;
  name: string;
  type: string;
  probability: number;
  description: string;
}

export interface CompareResult {
  baseline: { changeoverMinutes: number; oee: number; operators: number; mode: string };
  optimized: { changeoverMinutes: number; oee: number; operators: number; mode: string };
  reduction: { changeover: number; oeeGain: number; operator: number };
  targets: { changeoverMinutes: [number, number]; oee: number; operatorReduction: number };
  baselineAvgSaved: number;
}

export interface Meta {
  generatedAt: string;
  timeSpanDays: number;
  seed: number;
  datasetVersion: number;
  counts: Record<string, number>;
  scenarios: Scenario[];
  agentNames: Record<AgentType, string>;
}

export interface ImportBatch {
  id: string;
  kind: string;
  filename?: string | null;
  mode: string;
  total: number;
  imported: number;
  failed: number;
  errors_json?: string;
  created_at: string;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResponse {
  batchId: string;
  kind: string;
  mode: string;
  total: number;
  imported: number;
  failed: number;
  errors: ImportError[];
  counts: Record<string, number>;
}

export interface AuditEntry {
  id: number;
  ts: string;
  request_id?: string | null;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  ip?: string | null;
}

export interface WorkorderRow {
  id: number;
  batch_id: string;
  from_product: string;
  to_product: string;
  scenario: string;
  line?: string | null;
  day?: number | null;
  planned_start_minute?: number | null;
  created_at: string;
}

export interface LineStatus {
  line: string;
  status: string;
  currentProduct: string | null;
  oee: number;
  activeChangeover: string | null;
}

export interface ChangeoverProgress {
  eventId: string;
  phase: string;
  progress: number;
  message: string;
  scenario: string;
  fromProduct: string;
  toProduct: string;
}

export interface RealtimeAlert {
  level: 'info' | 'warn' | 'error';
  title: string;
  detail: string;
  ts: number;
}

