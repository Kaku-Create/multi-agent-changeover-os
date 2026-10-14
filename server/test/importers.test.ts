import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/lib/parsers.js';
import {
  normalizeEquipment,
  normalizeMaterials,
  normalizeOperators,
  normalizeProducts,
  normalizeWorkorders,
} from '../src/engine/importers.js';

test('parseCsv 正确处理 BOM 头与引号', () => {
  const rows = parseCsv('\uFEFF物料编码,物料描述\nM001,"片式电阻, 0603"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['物料编码'], 'M001');
  assert.equal(rows[0]['物料描述'], '片式电阻, 0603');
});

test('normalizeProducts 按产品聚合 BOM 行', () => {
  const rows = parseCsv(
    '成品专用号,成品描述,面,排产数量,订单批次号,物料编码,用量\nP1,pcb,TOP,100,B1,M1,3\nP1,pcb,TOP,100,B1,M2,2\nP1,pcb,BOT,100,B1,M3,1',
  );
  const r = normalizeProducts(rows);
  assert.equal(r.errors.length, 0);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].materialCount, 3);
  assert.equal(r.items[0].totalComponents, 6);
  assert.deepEqual(r.items[0].faces.sort(), ['BOT', 'TOP']);
});

test('normalizeProducts 缺少编码时记录错误', () => {
  const r = normalizeProducts([{ 成品描述: 'x' }]);
  assert.equal(r.items.length, 0);
  assert.equal(r.errors.length, 1);
});

test('normalizeMaterials 去重并推断分类', () => {
  const rows = [
    { 物料编码: 'M1', 物料描述: '片式电阻', 库存: '500' },
    { 物料编码: 'M1', 物料描述: '片式电阻', 库存: '500' },
    { 物料编码: 'M2', 物料描述: '片式电容' },
  ];
  const r = normalizeMaterials(rows);
  assert.equal(r.items.length, 2);
  assert.equal(r.items.find((m) => m.sku === 'M1')!.category, '片式电阻');
  assert.equal(r.items.find((m) => m.sku === 'M1')!.stock, 500);
});

test('normalizeEquipment 未知类型回退且缺少编号报错', () => {
  const r = normalizeEquipment([
    { 设备编号: 'E1', 设备类型: '神秘设备' },
    { 设备名称: '无编号设备' },
  ]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, 'SMT贴片机');
  assert.equal(r.errors.length, 1);
});

test('normalizeOperators 工种/技能回退', () => {
  const r = normalizeOperators([
    { 工号: 'OP1', 姓名: '张三', 工种: '未知工种', 技能等级: '专家' },
  ]);
  assert.equal(r.items[0].role, '操作工');
  assert.equal(r.items[0].skill, '中级');
});

test('normalizeWorkorders 校验必填字段', () => {
  const r = normalizeWorkorders([
    { 源产品: 'A', 目标产品: 'B', 场景: 'agv_delay' },
    { 源产品: 'A' },
  ]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].scenario, 'agv_delay');
  assert.equal(r.errors.length, 1);
});
