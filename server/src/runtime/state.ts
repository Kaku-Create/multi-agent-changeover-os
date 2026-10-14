import type { AgentState } from '../domain/types.js';
import { AGENT_NAMES } from '../engine/tasks.js';
import { repository } from '../store/repository.js';

export function computeAgentStates(): AgentState[] {
  const counts = repository.counts();
  const overview = repository.getOverview();
  const events = repository.listEvents({ limit: 1000 });
  const success = events.filter((e) => e.success).length;
  const alerts = events.filter((e) => e.scenario !== 'normal').length;
  const qualityAlerts = events.filter((e) => !e.qualityPassed).length;
  const total = overview?.totalEvents ?? events.length;

  const capabilities: Record<string, string[]> = {
    scheduling: ['全局编排', '动态重排', '冲突消解', '偏差纠偏'],
    equipment: ['设备状态感知', '参数自动调取', '程序切换', '故障预警'],
    material: ['库存监控', '需求分析', '配送调度', '缺料预警'],
    tooling: ['工装选型', '状态检测', '拆装指引', '到位确认'],
    quality: ['首件检验触发', 'AI检测判定', '返工决策', '质量追溯'],
    employee: ['人员状态跟踪', '多技能派工', '工时优化', '安全监控'],
  };

  const last: Record<string, string> = {
    scheduling: `完成 ${total} 次换产编排，平均换产 ${overview?.avgChangeoverMinutes ?? '-'} 分钟`,
    equipment: `设备健康度巡检完成，累计调参 ${total} 次`,
    material: `监控 ${counts.materials} 个物料SKU，库存校核正常`,
    tooling: `管理 ${counts.toolings} 套工装夹具，到位确认率 99%`,
    quality: `首件检验合格率 ${overview?.qualityPassRate ?? '-'}%`,
    employee: `调度 ${counts.operators} 名作业人员，人员效率提升 20%`,
  };

  const loads: Record<string, number> = {
    scheduling: 78, equipment: 64, material: 58, tooling: 41, quality: 52, employee: 47,
  };

  const types = Object.keys(AGENT_NAMES) as (keyof typeof AGENT_NAMES)[];

  return types.map((type) => ({
    type,
    name: AGENT_NAMES[type],
    status: 'idle' as const,
    currentTask: null,
    load: loads[type] ?? 50,
    decisionCount:
      type === 'scheduling' || type === 'employee' || type === 'material' ? total * 2 : total,
    successCount: success,
    alertCount: type === 'quality' ? qualityAlerts : type === 'employee' ? Math.round(alerts * 0.3) : alerts,
    lastAction: last[type],
    capabilities: capabilities[type],
  }));
}
