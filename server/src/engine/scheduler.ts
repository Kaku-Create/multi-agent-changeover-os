import type {
  AgentType,
  ChangeoverStepKey,
  ChangeoverTask,
  OperatorRole,
} from '../domain/types.js';
import { BASELINE_ORDER, TASK_TEMPLATES, type RoleCapacity, type TaskTemplate } from './tasks.js';

export interface ScheduleOptions {
  parallel: boolean;
  capacities: RoleCapacity;
  agvCount: number;
  durations: Record<ChangeoverStepKey, number>;
  operatorAssign?: Record<string, string>;
}

export interface ScheduleResult {
  tasks: ChangeoverTask[];
  makespan: number;
  criticalPath: ChangeoverStepKey[];
  parallelism: number;
}

const byKey = new Map<ChangeoverStepKey, TaskTemplate>(
  TASK_TEMPLATES.map((t) => [t.key, t] as const),
);

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function bottomLevels(durations: Record<ChangeoverStepKey, number>): Record<string, number> {
  const memo: Record<string, number> = {};
  const visit = (key: ChangeoverStepKey): number => {
    if (memo[key] !== undefined) return memo[key];
    const tpl = byKey.get(key)!;
    const children = TASK_TEMPLATES.filter((t) => t.dependsOn.includes(key));
    const childMax = children.length ? Math.max(...children.map((c) => visit(c.key))) : 0;
    memo[key] = durations[key] + childMax;
    return memo[key];
  };
  TASK_TEMPLATES.forEach((t) => visit(t.key));
  return memo;
}

export function scheduleChangeover(options: ScheduleOptions): ScheduleResult {
  const { durations, capacities, agvCount, parallel } = options;

  if (!parallel) {
    let cursor = 0;
    const tasks: ChangeoverTask[] = BASELINE_ORDER.map((key, index) => {
      const tpl = byKey.get(key)!;
      const duration = durations[key];
      const start = cursor;
      const end = round2(cursor + duration);
      cursor = end;
      return {
        id: `B${index + 1}`,
        step: key,
        name: tpl.name,
        agent: tpl.agent,
        duration,
        estimatedDuration: tpl.baseDuration,
        start: round2(start),
        end,
        status: 'done',
        dependsOn: tpl.dependsOn,
        resource: tpl.resource,
        requiredRole: tpl.requiredRole,
        parallelizable: tpl.parallelizable,
        isCritical: true,
      };
    });
    return {
      tasks,
      makespan: round2(cursor),
      criticalPath: [...BASELINE_ORDER],
      parallelism: 1,
    };
  }

  const priority = bottomLevels(durations);
  const usedRole: Record<string, number> = { 设备工程师: 0, 操作工: 0, 质检员: 0, 物料员: 0 };
  const scheduled = new Map<ChangeoverStepKey, ChangeoverTask>();
  const running: ChangeoverTask[] = [];
  let usedAgv = 0;
  let time = 0;
  let idSeq = 1;

  const depsDone = (tpl: TaskTemplate): boolean =>
    tpl.dependsOn.every((d) => scheduled.has(d) && scheduled.get(d)!.end <= time);

  const canStart = (tpl: TaskTemplate): boolean => {
    if (tpl.requiredRole && usedRole[tpl.requiredRole] >= capacities[tpl.requiredRole]) return false;
    if (tpl.usesAgv && usedAgv >= agvCount) return false;
    return true;
  };

  const order = [...TASK_TEMPLATES].sort((a, b) => priority[b.key] - priority[a.key]);

  let guard = 0;
  while (scheduled.size < TASK_TEMPLATES.length && guard < 1000) {
    guard += 1;
    for (const tpl of order) {
      if (scheduled.has(tpl.key)) continue;
      if (!depsDone(tpl)) continue;
      if (!canStart(tpl)) continue;
      const duration = round2(durations[tpl.key]);
      const start = round2(time);
      const end = round2(time + duration);
      const task: ChangeoverTask = {
        id: `T${idSeq++}`,
        step: tpl.key,
        name: tpl.name,
        agent: tpl.agent,
        duration,
        estimatedDuration: tpl.baseDuration,
        start,
        end,
        status: 'done',
        dependsOn: tpl.dependsOn,
        resource: tpl.resource,
        requiredRole: tpl.requiredRole,
        parallelizable: tpl.parallelizable,
        isCritical: false,
      };
      scheduled.set(tpl.key, task);
      running.push(task);
      if (tpl.requiredRole) usedRole[tpl.requiredRole] += 1;
      if (tpl.usesAgv) usedAgv += 1;
    }

    const pending = order.filter((t) => !scheduled.has(t.key));
    if (pending.length === 0) break;
    if (running.length === 0) break;

    const nextTime = Math.min(...running.map((t) => t.end));
    time = round2(nextTime);
    for (let i = running.length - 1; i >= 0; i--) {
      const t = running[i];
      if (t.end <= time) {
        running.splice(i, 1);
        if (t.requiredRole) usedRole[t.requiredRole] -= 1;
        if (byKey.get(t.step)!.usesAgv) usedAgv -= 1;
      }
    }
  }

  const tasks = order
    .map((tpl) => scheduled.get(tpl.key)!)
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const makespan = round2(Math.max(...tasks.map((t) => t.end)));

  const cpEnd: Record<string, number> = {};
  const cpVisit = (key: ChangeoverStepKey): number => {
    if (cpEnd[key] !== undefined) return cpEnd[key];
    const t = scheduled.get(key)!;
    const deps = t.dependsOn.map((d) => cpVisit(d));
    cpEnd[key] = round2(t.duration + (deps.length ? Math.max(...deps) : 0));
    return cpEnd[key];
  };
  tasks.forEach((t) => cpVisit(t.step));
  let tail = tasks[0];
  tasks.forEach((t) => {
    if (cpEnd[t.step] > cpEnd[tail.step]) tail = t;
  });
  const criticalPath: ChangeoverStepKey[] = [];
  let cursor: ChangeoverStepKey | null = tail?.step ?? null;
  while (cursor) {
    criticalPath.unshift(cursor);
    const t: TaskTemplate = byKey.get(cursor)!;
    if (!t.dependsOn.length) break;
    let best: ChangeoverStepKey | null = null;
    for (const d of t.dependsOn as ChangeoverStepKey[]) {
      if (!best || cpEnd[d] > cpEnd[best]) best = d;
    }
    cursor = best;
  }

  let maxConcurrent = 1;
  for (let t = 0; t <= makespan; t += 0.5) {
    const active = tasks.filter((x) => x.start <= t && x.end > t).length;
    maxConcurrent = Math.max(maxConcurrent, active);
  }

  const criticalSet = new Set(criticalPath);
  tasks.forEach((t) => {
    t.isCritical = criticalSet.has(t.step);
  });

  return { tasks, makespan, criticalPath, parallelism: maxConcurrent };
}

export function estimateOee(
  changeoverMinutes: number,
  qualityPassed: boolean,
  shiftProductionMinutes = 480,
): number {
  const base = 0.7 + (30 - changeoverMinutes) * 0.009;
  const qualityPenalty = qualityPassed ? 0 : 0.05;
  const oee = Math.max(0.45, Math.min(0.94, base - qualityPenalty));
  return Math.round(oee * 1000) / 10;
}

export function agentAccent(agent: AgentType): string {
  return agent;
}

export type { OperatorRole };
