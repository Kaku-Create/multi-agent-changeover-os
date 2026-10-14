import React from 'react';
import { api } from '../lib/api';
import { useAsync, Loading, ErrorState } from '../lib/useAsync';
import { Panel, DataTable, Badge, KpiCard } from '../components/ui';
import { LineChart } from '../components/charts';
import { fmt } from '../lib/format';
import type { EventSummary } from '../lib/types';

const STRATEGY_LABEL: Record<string, string> = {
  parallelThreshold: '并行调度阈值',
  materialLeadSeconds: '物料提前期',
  inspectionBuffer: '首件检验缓冲',
  agvCount: 'AGV 配置数',
  preLoadRatio: '物料前置比例',
  operatorFlexibility: '人员柔性系数',
};

export function Learning() {
  const learning = useAsync(() => api.learning());
  const events = useAsync(() => api.events(200));
  const insights = useAsync(() => api.learningInsights());
  const strategies = useAsync(() => api.learningStrategies());

  if (learning.loading || !learning.data)
    return learning.error ? <ErrorState error={learning.error} onRetry={learning.reload} /> : <Loading label="加载学习记录" />;
  const records = learning.data.items;
  const evs = events.data?.items ?? [];

  const early = records.slice(0, 10);
  const late = records.slice(-10);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const earlyAvg = avg(early.map((r) => r.makespan));
  const lateAvg = avg(late.map((r) => r.makespan));

  const bottleneckCount = evs.reduce<Record<string, number>>((acc, e) => {
    acc[e.bottleneck] = (acc[e.bottleneck] ?? 0) + 1;
    return acc;
  }, {});
  const bottlenecks = Object.entries(bottleneckCount).sort((a, b) => b[1] - a[1]);

  const lastParams = records[records.length - 1]?.params;
  const ins = insights.data;
  const strat = strategies.data;

  const templates = [
    { name: '并行预置模板', trigger: '正常换产 / 库存充足', strategy: '物料前置拣配 + 设备与工装并行，首件检验作为汇聚节点', gain: '换产 16-17 分钟' },
    { name: 'AGV降级模板', trigger: 'AGV配送延迟', strategy: '冻结物料任务，优先推进设备调参与工装切换，物料到位后立即校验', gain: '异常影响压缩至 2-3 分钟' },
    { name: '缺料替代模板', trigger: '物料低于安全库存', strategy: '触发紧急拣配与替代料确认，同步调整首件检验物料核对清单', gain: '避免产线停等' },
    { name: '设备告警模板', trigger: '设备报警', strategy: '备用设备热切换 + 参数重校准 + 首件复检绑定', gain: '保障换产连续性' },
    { name: '质量返工模板', trigger: '首件不合格', strategy: '定向回退参数调校并二次检验，记录根因进入知识库', gain: '质量闭环' },
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-4">
        <KpiCard label="初期平均换产" value={fmt(earlyAvg)} unit="min" trend="第 1-10 次换产" color="#6b7c9e" helpKey="makespan" />
        <KpiCard label="后期平均换产" value={fmt(lateAvg)} unit="min" trend={`较初期下降 ${fmt(((earlyAvg - lateAvg) / earlyAvg) * 100)}%`} trendGood progress={((earlyAvg - lateAvg) / earlyAvg) * 100} color="#10b981" helpKey="makespan" />
        <KpiCard label="调度准确率" value={fmt(avg(records.map((r) => r.accuracy)) * 100)} unit="%" trend="基于历史偏差自校正" trendGood progress={avg(records.map((r) => r.accuracy)) * 100} color="#22d3ee" helpKey="learning_accuracy" />
        <KpiCard label="策略模板" value={templates.length} unit="套" trend="沉淀可复用换产知识" trendGood progress={100} color="#a855f7" helpKey="agent_capabilities" />
      </div>

      <div className="grid cols-2">
        <Panel title="换产耗时自学习曲线" sub="随历史数据积累，调度策略持续优化，换产耗时逐步收敛" helpKey="learning_accuracy">
          <LineChart
            yUnit="′"
            yMin={12}
            yMax={20}
            targetLine={{ value: 15, label: '最优目标 15 分钟', color: '#10b981' }}
            series={[{ name: '换产耗时', color: '#22d3ee', points: records.map((r) => r.makespan) }]}
            labels={records.map((r) => r.sequence)}
          />
        </Panel>
        <Panel title="策略参数自学习轨迹" sub="前移预置、并行阈值与人员柔性随迭代提升" helpKey="pre_load_ratio">
          <LineChart
            yMin={0}
            yMax={1}
            series={[
              { name: '物料前置比例', color: '#f59e0b', points: records.map((r) => r.params.preLoadRatio) },
              { name: '并行阈值', color: '#a855f7', points: records.map((r) => r.params.parallelThreshold) },
              { name: '人员柔性', color: '#22d3ee', points: records.map((r) => r.params.operatorFlexibility) },
              { name: '调度准确率', color: '#10b981', points: records.map((r) => r.accuracy) },
            ]}
            labels={records.map((r) => r.sequence)}
          />
          <div className="legend" style={{ marginTop: 8 }}>
            <span><span className="dot" style={{ background: '#f59e0b' }} />物料前置比例</span>
            <span><span className="dot" style={{ background: '#a855f7' }} />并行阈值</span>
            <span><span className="dot" style={{ background: '#22d3ee' }} />人员柔性</span>
            <span><span className="dot" style={{ background: '#10b981' }} />调度准确率</span>
          </div>
        </Panel>
      </div>

      <div className="grid cols-2">
        <div className="grid cols-2">
        <Panel title="每日换产耗时趋势" sub="按天聚合 30 天换产耗时均值" helpKey="time_span_days">
          {ins && ins.byDay.length > 0 ? (
            <LineChart
              yUnit="′"
              yMin={12}
              yMax={20}
              series={[{ name: '日均换产耗时', color: '#22d3ee', points: ins.byDay.map((d) => d.avgMakespan) }]}
              labels={ins.byDay.map((d) => `D${d.day}`)}
            />
          ) : (
            <div className="muted">暂无数据</div>
          )}
          <div className="muted" style={{ marginTop: 8 }}>
            样本数 <b>{ins?.totalCount ?? 0}</b>；平均调度准确率 <b>{fmt((ins?.avgAccuracy ?? 0) * 100)}%</b>；平均并行度 <b>{fmt(ins?.avgParallelism ?? 0)}</b>
          </div>
        </Panel>
        <Panel title="策略参数收敛情况" sub="策略参数自学习后的均值与最新值" helpKey="pre_load_ratio">
          {strat && strat.samples > 0 ? (
            <div className="grid cols-2">
              {Object.entries(strat.paramsAvg).map(([k, v]) => (
                <div className="kv" key={k}>
                  <span>{STRATEGY_LABEL[k] ?? k}</span>
                  <b>
                    {k === 'agvCount' || k === 'materialLeadSeconds'
                      ? `${fmt(v as number)} ${k === 'materialLeadSeconds' ? 's' : '台'}`
                      : `${fmt((v as number) * 100)}%`}
                  </b>
                </div>
              ))}
              <div className="kv"><span>样本数</span><b>{strat.samples}</b></div>
              <div className="kv"><span>平均调度准确率</span><b>{fmt(strat.avgAccuracy * 100)}%</b></div>
            </div>
          ) : (
            <div className="muted">暂无数据</div>
          )}
        </Panel>
      </div>

      <Panel title="换产瓶颈识别" sub="统计各环节成为瓶颈的频次，指导持续改进" helpKey="bottleneck">
          {bottlenecks.map(([name, count]) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div className="kv" style={{ border: 'none', padding: '2px 0' }}>
                <span>{name}</span><b>{count} 次</b>
              </div>
              <div className="progress">
                <span style={{ width: `${(count / bottlenecks[0][1]) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="当前最优策略参数" sub="学习迭代后收敛的参数组合">
          {lastParams && (
            <div className="grid cols-2">
              <div className="kv"><span>物料前置比例</span><b>{fmt(lastParams.preLoadRatio * 100)}%</b></div>
              <div className="kv"><span>并行调度阈值</span><b>{fmt(lastParams.parallelThreshold * 100)}%</b></div>
              <div className="kv"><span>人员柔性系数</span><b>{fmt(lastParams.operatorFlexibility * 100)}%</b></div>
              <div className="kv"><span>AGV 配置数</span><b>{fmt(lastParams.agvCount)} 台</b></div>
              <div className="kv"><span>首件检验缓冲</span><b>{fmt(lastParams.inspectionBuffer * 100)}%</b></div>
              <div className="kv"><span>物料提前期</span><b>{lastParams.materialLeadSeconds}s</b></div>
            </div>
          )}
          <div className="muted" style={{ marginTop: 12 }}>
            自学习能力：系统基于历史换产数据自动优化调度策略参数，识别瓶颈环节并形成可复用策略模板。
          </div>
        </Panel>
      </div>

      <Panel title="可复用策略模板库" sub="由历史换产知识沉淀形成，异常场景下可一键匹配">
        <DataTable
          keyField={(r) => r.name}
          rows={templates}
          columns={[
            { key: 'name', title: '模板名称', render: (r) => <b>{r.name}</b> },
            { key: 'trigger', title: '触发条件', render: (r) => <Badge color="#f59e0b">{r.trigger}</Badge> },
            { key: 'strategy', title: '策略要点' },
            { key: 'gain', title: '预期收益', render: (r) => <span style={{ color: '#10b981' }}>{r.gain}</span> },
          ]}
        />
      </Panel>

      <Panel title="换产事件学习明细" sub="最近 12 次换产的学习结果">
        <DataTable<EventSummary & { hashtag?: string }>
          keyField={(r) => r.id}
          rows={(evs.slice(-12).reverse()) as (EventSummary & { hashtag?: string })[]}
          columns={[
            { key: 'sequence', title: '序号', render: (r) => `#${r.sequence}` },
            { key: 'actualMinutes', title: '换产耗时', render: (r) => <b style={{ color: '#22d3ee' }}>{fmt(r.actualMinutes)}′</b> },
            { key: 'parallelism', title: '并行度', render: (r) => `${r.parallelism} 路` },
            { key: 'bottleneck', title: '识别瓶颈' },
            { key: 'savedRatio', title: '节省', render: (r) => `${fmt(r.savedRatio)}%` },
            { key: 'success', title: '结果', render: (r) => <Badge color={r.success ? '#10b981' : '#f59e0b'}>{r.success ? '达标' : '观察'}</Badge> },
          ]}
        />
      </Panel>
    </div>
  );
}
