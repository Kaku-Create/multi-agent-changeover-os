import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleChangeover, estimateOee } from '../src/engine/scheduler.js';
import { TASK_TEMPLATES, BASELINE_ORDER, type RoleCapacity } from '../src/engine/tasks.js';
import type { ChangeoverStepKey } from '../src/domain/types.js';

const durations = Object.fromEntries(
  TASK_TEMPLATES.map((t) => [t.key, t.baseDuration]),
) as Record<ChangeoverStepKey, number>;

const capacities: RoleCapacity = { 设备工程师: 2, 操作工: 3, 质检员: 1, 物料员: 2 };

test('传统串行计划 makespan 等于各任务耗时之和', () => {
  const result = scheduleChangeover({ parallel: false, capacities, agvCount: 1, durations });
  const sum = TASK_TEMPLATES.reduce((a, t) => a + durations[t.key], 0);
  assert.equal(result.tasks.length, TASK_TEMPLATES.length);
  assert.ok(Math.abs(result.makespan - sum) < 0.01, `makespan ${result.makespan} != sum ${sum}`);
  assert.equal(result.parallelism, 1);
});

test('并行协同 makespan 严格小于串行且关键路径有效', () => {
  const serial = scheduleChangeover({ parallel: false, capacities, agvCount: 2, durations });
  const parallel = scheduleChangeover({ parallel: true, capacities, agvCount: 2, durations });
  assert.ok(parallel.makespan < serial.makespan, '并行应快于串行');
  assert.ok(parallel.makespan >= Math.max(...TASK_TEMPLATES.map((t) => durations[t.key])));
  assert.ok(parallel.criticalPath.length >= 2);
  for (const step of parallel.criticalPath) {
    assert.ok(TASK_TEMPLATES.some((t) => t.key === step), `关键路径包含未知任务 ${step}`);
  }
});

test('并行调度不违反任务依赖与角色容量约束', () => {
  const result = scheduleChangeover({ parallel: true, capacities, agvCount: 2, durations });
  const map = new Map(result.tasks.map((t) => [t.step, t]));
  for (const task of result.tasks) {
    for (const dep of task.dependsOn) {
      const d = map.get(dep)!;
      assert.ok(d.end <= task.start + 0.001, `${task.step} 在依赖 ${dep} 完成前开始`);
    }
  }
  const points = result.tasks.flatMap((t) => [t.start, t.end]);
  for (const p of points) {
    const active = result.tasks.filter((t) => t.start <= p && t.end > p && t.requiredRole);
    const perRole: Record<string, number> = {};
    for (const t of active) perRole[t.requiredRole!] = (perRole[t.requiredRole!] ?? 0) + 1;
    for (const [role, n] of Object.entries(perRole)) {
      assert.ok(n <= capacities[role as keyof RoleCapacity], `角色 ${role} 并发 ${n} 超容量`);
    }
  }
});

test('所有基础任务均被调度且至少一条关键路径任务', () => {
  const result = scheduleChangeover({ parallel: true, capacities, agvCount: 2, durations });
  assert.deepEqual(
    [...result.tasks.map((t) => t.step)].sort(),
    [...BASELINE_ORDER].sort(),
  );
  assert.ok(result.tasks.some((t) => t.isCritical));
});

test('OEE 模型随换产时间缩短而提升，且质量不合格扣减', () => {
  const a = estimateOee(30, true);
  const b = estimateOee(16, true);
  const c = estimateOee(16, false);
  assert.ok(b > a, '换产更短 OEE 应更高');
  assert.ok(c < b, '质量不合格 OEE 应扣减');
  assert.ok(a >= 65 && a <= 72, `基线 OEE ${a} 应处于 65-72 区间`);
  assert.ok(b >= 80, `协同 OEE ${b} 应 ≥80`);
});
