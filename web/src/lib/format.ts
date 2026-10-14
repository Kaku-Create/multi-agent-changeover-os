import type { AgentType } from './types';

export const AGENT_LABEL: Record<AgentType, string> = {
  scheduling: '调度智能体',
  equipment: '设备智能体',
  material: '物料智能体',
  tooling: '工装智能体',
  quality: '质量智能体',
  employee: '人员调度智能体',
};

export const AGENT_COLOR: Record<AgentType, string> = {
  scheduling: '#6366f1',
  equipment: '#06b6d4',
  material: '#f59e0b',
  tooling: '#a855f7',
  quality: '#10b981',
  employee: '#ef4444',
};

export const SCENARIO_LABEL: Record<string, string> = {
  normal: '正常换产',
  agv_delay: 'AGV配送延迟',
  material_shortage: '物料短缺',
  equipment_alarm: '设备报警',
  quality_fail: '首件不合格',
  staff_absence: '人员缺勤',
};

export const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  running: '运行中',
  changeover: '换产中',
  fault: '故障',
  maintenance: '维护中',
  working: '作业中',
  moving: '移动中',
  break: '休息',
  in_place: '在位',
  pending: '待装',
  installing: '拆装中',
  inspecting: '检测中',
  ready: '就绪',
};

export function scenarioColor(type: string): string {
  switch (type) {
    case 'normal': return '#10b981';
    case 'agv_delay': return '#f59e0b';
    case 'material_shortage': return '#f97316';
    case 'equipment_alarm': return '#ef4444';
    case 'quality_fail': return '#e11d48';
    case 'staff_absence': return '#8b5cf6';
    default: return '#64748b';
  }
}

export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits);
}

export function timeLabel(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return s > 0 ? `${m}分${s}秒` : `${m}分`;
}
