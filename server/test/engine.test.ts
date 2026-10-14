import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset, simulateSingle } from '../src/engine/seed.js';

const dataset = generateDataset(20261002);

test('模拟数据规模满足赛题要求', () => {
  assert.ok(dataset.products.length >= 10, '产品型号 ≥10');
  assert.ok(dataset.materials.length >= 50, '物料SKU ≥50');
  assert.ok(dataset.operators.length >= 10, '操作人员 ≥10');
  assert.ok(dataset.events.length >= 50, '换产事件 ≥50');
  assert.equal(dataset.timeSpanDays, 30, '时间跨度 ≥30 天');
  const types = new Set(dataset.equipment.map((e) => e.type));
  assert.ok(types.size >= 5, '设备类型 ≥5 类');
});

test('关键指标达到赛题目标', () => {
  const o = dataset.overview;
  assert.ok(o.avgChangeoverMinutes >= 15 && o.avgChangeoverMinutes <= 18, `换产 ${o.avgChangeoverMinutes} ∈ [15,18]`);
  assert.ok(o.oee >= 80, `OEE ${o.oee} ≥80`);
  assert.ok(o.baselineOee >= 65 && o.baselineOee <= 72, `基线 OEE ${o.baselineOee} 应处于 65-72`);
  assert.equal(o.operatorReduction, 20, '人员减少 20%');
  assert.ok(o.reductionRatio > 20, '换产周期缩短 >20%');
  assert.ok(o.qualityPassRate > 90, '首件合格率 >90%');
});

test('每个换产事件结构完整', () => {
  for (const e of dataset.events) {
    assert.ok(e.schedule.tasks.length >= 6, `${e.id} 任务不足`);
    assert.ok(e.timeline.length >= 6, `${e.id} 时序不足`);
    assert.ok(e.messages.length >= 6, `${e.id} 协同消息不足`);
    assert.ok(e.baselineMinutes > e.actualMinutes, `${e.id} 协同未优于传统`);
  }
});

test('自学习使后期换产耗时下降', () => {
  const early = dataset.learning.slice(0, 10).reduce((a, r) => a + r.makespan, 0) / 10;
  const late = dataset.learning.slice(-10).reduce((a, r) => a + r.makespan, 0) / 10;
  assert.ok(late <= early, `后期 ${late} 应不大于初期 ${early}`);
});

test('单次换产仿真可复现且含纠偏记录', () => {
  const a = simulateSingle({ scenario: 'agv_delay', seed: 999 });
  const b = simulateSingle({ scenario: 'agv_delay', seed: 999 });
  assert.equal(a.actualMinutes, b.actualMinutes, '相同种子结果应一致');
  assert.equal(a.scenario, 'agv_delay');
  assert.ok(a.deviations.length >= 1, '异常场景应有纠偏记录');
});
