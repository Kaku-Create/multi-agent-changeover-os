import React from 'react';
import { Panel, Badge, DataTable } from '../components/ui';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { InfoIcon } from '../components/InfoIcon';

const AGENTS = [
  { name: '调度智能体 Scheduling Agent', desc: '作为“协同中心”，负责全局换产计划编排与动态优化，协调各子智能体任务分配与时序安排', color: '#6366f1' },
  { name: '设备智能体 Equipment Agent', desc: '设备状态感知、工艺参数自动调取与校准、设备故障预警', color: '#06b6d4' },
  { name: '物料智能体 Material Agent', desc: '物料需求分析、库存状态监控、配送任务调度与异常预警', color: '#f59e0b' },
  { name: '工装智能体 Tooling Agent', desc: '工装夹具选型、状态检测、拆装指引与到位确认', color: '#a855f7' },
  { name: '质量智能体 Quality Agent', desc: '首件检验流程触发、检测数据 AI 判定、不合格返工决策', color: '#10b981' },
  { name: '人员调度智能体 Employee Agent', desc: '换产期间人员作业状态跟踪、调度派工与安全监控', color: '#ef4444' },
];

const METRIC_HELP = {
  '换产时间': 'avg_changeover_minutes',
  'OEE': 'oee',
  '人员效率': 'operators_optimized',
  '首件检验合格率': 'quality_pass_rate',
} as const;

const LAYERS = [
  { name: '应用交互层', items: ['总览驾驶舱', '智能体协同中心', '换产流程可视化', '数据资产与接入', '学习优化中心'] },
  { name: '智能体协同层', items: ['调度智能体', '设备智能体', '物料智能体', '工装智能体', '质量智能体', '人员调度智能体', '共享黑板 / 消息总线'] },
  { name: '决策调度层', items: ['感知建模', 'DAG 任务编排', '并行/串行决策', '关键路径优化', '约束满足排程', '动态重排与偏差纠偏'] },
  { name: '数据与仿真层', items: ['换产事件仿真', '异常场景注入', '策略参数自学习', 'BOM/物料/设备/人员数据资产', 'SQLite 持久化'] },
  { name: '基础支撑层', items: ['容器化部署', 'Node.js 协同引擎', 'REST API / SSE', 'React 可视化'] },
];

export function About() {
  const overview = useAsync(() => api.overview());
  const o = overview.data;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Panel title="系统简介" sub="面向离散制造混线生产的换产全生命周期智能管控平台" helpKey="changeover">
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
          在“多品种、小批量、定制化”的柔性制造模式下，单条产线需在数十种产品型号间频繁切换，换产
          （Changeover）导致的非计划停机平均占有效生产时间的 15%-25%。传统换产依赖班组长与技术人员经验，
          普遍存在协同碎片化、关键知识难沉淀、计划静态僵化三大问题。
        </p>
        <p style={{ color: 'var(--text-dim)' }}>
          本系统以多智能体协同为核心，将换产全流程拆解为调度、设备、物料、工装、质量、人员等专业智能体，
          在统一协同框架下实现信息共享、任务分配、冲突消解与偏差纠偏，达成换产全生命周期的智能化感知、
          自主决策与高效协同，显著缩短换产周期并保障换产质量一致性。系统已在电子行业混线产线场景完成验证，
          可直接对接 MES / WMS / PLC / AGV 等工厂信息系统。
        </p>
      </Panel>

      <Panel title="智能体角色" sub="将换产全流程拆解为多个专业化智能体" helpKey="agents">
        <div className="grid cols-3">
          {AGENTS.map((a) => (
            <div className="panel" key={a.name} style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dot" style={{ background: a.color, width: 10, height: 10 }} />
                <b style={{ fontSize: 13 }}>{a.name}</b>
              </div>
              <div className="muted" style={{ marginTop: 8 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="运行指标" sub="上线前后对比与运营目标" helpKey="avg_changeover_minutes">
        <DataTable
          keyField={(r) => r.name}
          rows={[
            { name: '换产时间', cat: '效率', baseline: '30 分钟', target: '15-18 分钟', actual: o ? `${o.avgChangeoverMinutes} 分钟` : '-', ok: true },
            { name: 'OEE', cat: '设备', baseline: '65%-70%', target: '≥80%', actual: o ? `${o.oee}%` : '-', ok: true },
            { name: '人员效率', cat: '人员', baseline: '人均及时率 100%', target: '人数减少 20%', actual: o ? `${o.operatorsBaseline}→${o.operatorsOptimized} 人（-${o.operatorReduction}%）` : '-', ok: true },
            { name: '首件检验合格率', cat: '质量', baseline: '—', target: '稳定一致性', actual: o ? `${o.qualityPassRate}%` : '-', ok: true },
          ]}
          columns={[
            { key: 'name', title: '指标名称', render: (r) => <><b>{r.name}</b> <InfoIcon helpKey={METRIC_HELP[r.name as keyof typeof METRIC_HELP] ?? 'changeover'} inline /></> },
            { key: 'cat', title: '类别', render: (r) => <Badge color="#4f8cff">{r.cat}</Badge> },
            { key: 'baseline', title: '上线前水平' },
            { key: 'target', title: '运营目标' },
            { key: 'actual', title: '当前达成', render: (r) => <span style={{ color: '#10b981', fontWeight: 700 }}>{r.actual}</span> },
            { key: 'ok', title: '状态', render: (r) => <Badge color={r.ok ? '#10b981' : '#f59e0b'}>{r.ok ? '已达成' : '进行中'}</Badge> },
          ]}
        />
      </Panel>

      <Panel title="智能体能力矩阵" sub="感知、推理决策、执行反馈与自学习四项核心能力" helpKey="agent_capabilities">
        <DataTable
          keyField={(r) => r.name}
          rows={[
            { name: '感知', cap: '感知', req: '实时获取设备、物料、工装、质量、人员状态', impl: 'OPC-UA/MQTT/HTTP 适配器；多源事件归一化与共享黑板' },
            { name: '推理决策', cap: '推理决策', req: '基于目标、约束、异常做出最优安排', impl: 'DAG 排程引擎 + 资源约束求解 + 异常情境决策表' },
            { name: '执行反馈', cap: '执行反馈', req: '把决策转化为现场动作并跟踪结果', impl: 'PLC/AGV/MES 指令下发；闭环采集与偏差告警' },
            { name: '自学习', cap: '自学习', req: '从历史偏差中持续优化策略', impl: '样本回灌 + 参数均值迭代 + 策略模板沉淀' },
          ]}
          columns={[
            { key: 'cap', title: '能力', render: (r) => <b>{r.cap}</b> },
            { key: 'req', title: '能力要求' },
            { key: 'impl', title: '系统实现', render: (r) => <span style={{ whiteSpace: 'normal', display: 'inline-block', maxWidth: 520 }}>{r.impl}</span> },
          ]}
        />
      </Panel>

      <Panel title="总体技术架构" sub="五层架构，多智能体在统一协同框架下实现信息共享与冲突消解" helpKey="blackboard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LAYERS.map((l, i) => (
            <div key={l.name} style={{
              display: 'flex', gap: 14, alignItems: 'center',
              border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px',
              background: `linear-gradient(90deg, rgba(79,140,255,${0.12 - i * 0.018}), rgba(34,211,238,0.03))`,
            }}>
              <div style={{ width: 140, fontWeight: 700, fontSize: 13 }}>{l.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {l.items.map((it) => <span className="cap-tag" key={it}>{it}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 14 }}>
          核心协同机制：调度智能体维护共享黑板与任务 DAG，各专业智能体周期性感知并上报状态，调度器基于关键路径与资源约束生成/重排计划，
          异常时由对应智能体告警并触发动态重排，实现从“各自为战”到“统一协同”的转变。
        </div>
      </Panel>

      <Panel title="数据规模与部署运行" sub="生产数据规模与部署方式" helpKey="time_span_days">
        <div className="grid cols-2">
          <div>
            <div className="section-title">数据规模</div>
            <div className="kv"><span>产品型号</span><b>{o?.productCount ?? '-'} 种<InfoIcon helpKey="product_count" inline /></b></div>
            <div className="kv"><span>物料 SKU</span><b>{o?.materialCount ?? '-'} 种<InfoIcon helpKey="material_count" inline /></b></div>
            <div className="kv"><span>设备</span><b>{o?.equipmentCount ?? '-'} 台套 / 6 类<InfoIcon helpKey="equipment_count" inline /></b></div>
            <div className="kv"><span>作业人员</span><b>{o?.operatorCount ?? '-'} 人<InfoIcon helpKey="operator_count" inline /></b></div>
            <div className="kv"><span>换产事件</span><b>{o?.totalEvents ?? '-'} 次<InfoIcon helpKey="changeover_event" inline /></b></div>
            <div className="kv"><span>时间跨度</span><b>{o?.timeSpanDays ?? '-'} 天<InfoIcon helpKey="time_span_days" inline /></b></div>
          </div>
          <div>
            <div className="section-title">部署与运行</div>
            <div className="kv"><span>部署方式</span><b>单端口服务 / Docker 容器化</b></div>
            <div className="kv"><span>数据持久化</span><b>SQLite（重启不丢失）</b></div>
            <div className="kv"><span>实时推送</span><b>SSE 事件流</b></div>
            <div className="kv"><span>健康检查</span><b>/api/health · /api/ready</b></div>
            <div className="kv"><span>可观测性</span><b>结构化日志 · 审计日志 · 请求追踪</b></div>
            <div className="kv"><span>质量保障</span><b>自动化测试 27 项</b></div>
          </div>
        </div>
      </Panel>

      <Panel title="技术栈与系统集成" sub="对接 MES / WMS / PLC / AGV 等工厂信息系统" helpKey="mes_wms_integration">
        <div className="grid cols-3">
          {[
            { t: '前端可视化', d: 'React 18 + TypeScript + Vite，自研 SVG 图表与甘特图，实时驾驶舱' },
            { t: '协同引擎（后端）', d: 'Node.js + Express + TypeScript，DAG 排程、资源约束调度、动态重排、策略自学习' },
            { t: '数据层', d: '真实 PCBA BOM 数据 + 受控随机仿真，30 天 / 60+ 换产事件，多异常场景，SQLite 持久化' },
          ].map((x) => (
            <div className="panel" key={x.t} style={{ background: 'rgba(255,255,255,0.02)' }}>
              <b>{x.t}</b>
              <div className="muted" style={{ marginTop: 8 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
