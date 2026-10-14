import type { AgentType, ChangeoverStepKey, OperatorRole } from '../domain/types.js';

export interface TaskTemplate {
  key: ChangeoverStepKey;
  name: string;
  agent: AgentType;
  baseDuration: number;
  requiredRole?: OperatorRole;
  resource: string;
  dependsOn: ChangeoverStepKey[];
  parallelizable: boolean;
  usesAgv?: boolean;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    key: 'line_clear',
    name: '旧品下线与清线',
    agent: 'scheduling',
    baseDuration: 3.5,
    requiredRole: '操作工',
    resource: '产线',
    dependsOn: [],
    parallelizable: false,
  },
  {
    key: 'program_switch',
    name: '设备程序与配方切换',
    agent: 'equipment',
    baseDuration: 3.0,
    requiredRole: '设备工程师',
    resource: 'SMT贴片机',
    dependsOn: ['line_clear'],
    parallelizable: true,
  },
  {
    key: 'parameter_tune',
    name: '关键工艺参数调校',
    agent: 'equipment',
    baseDuration: 4.0,
    requiredRole: '设备工程师',
    resource: '回流焊炉',
    dependsOn: ['program_switch'],
    parallelizable: true,
  },
  {
    key: 'material_prepare',
    name: '物料拣配与领料',
    agent: 'material',
    baseDuration: 4.5,
    requiredRole: '物料员',
    resource: '立库',
    dependsOn: ['line_clear'],
    parallelizable: true,
  },
  {
    key: 'material_delivery',
    name: 'AGV物料精准配送',
    agent: 'material',
    baseDuration: 3.5,
    requiredRole: '物料员',
    resource: 'AGV',
    dependsOn: ['material_prepare'],
    parallelizable: true,
    usesAgv: true,
  },
  {
    key: 'tooling_switch',
    name: '工装夹具拆装切换',
    agent: 'tooling',
    baseDuration: 5.0,
    requiredRole: '操作工',
    resource: '工装夹具',
    dependsOn: ['line_clear'],
    parallelizable: true,
  },
  {
    key: 'first_article',
    name: '首件检验与质量判定',
    agent: 'quality',
    baseDuration: 5.0,
    requiredRole: '质检员',
    resource: 'AOI检测机',
    dependsOn: ['parameter_tune', 'material_delivery', 'tooling_switch'],
    parallelizable: false,
  },
  {
    key: 'resume',
    name: '参数复核与恢复生产',
    agent: 'scheduling',
    baseDuration: 1.5,
    requiredRole: '设备工程师',
    resource: '产线',
    dependsOn: ['first_article'],
    parallelizable: false,
  },
];

export const BASELINE_ORDER: ChangeoverStepKey[] = [
  'line_clear',
  'program_switch',
  'parameter_tune',
  'material_prepare',
  'material_delivery',
  'tooling_switch',
  'first_article',
  'resume',
];

export interface RoleCapacity {
  设备工程师: number;
  操作工: number;
  质检员: number;
  物料员: number;
}

export const AGENT_NAMES: Record<AgentType, string> = {
  scheduling: '调度智能体',
  equipment: '设备智能体',
  material: '物料智能体',
  tooling: '工装智能体',
  quality: '质量智能体',
  employee: '人员调度智能体',
};
