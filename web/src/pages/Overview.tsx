import React from 'react';
import { api } from '../lib/api';
import { useAsync, Loading, ErrorState } from '../lib/useAsync';
import { Panel, KpiCard, DataTable, Badge } from '../components/ui';
import { Gauge, LineChart, BarCompare, Donut } from '../components/charts';
import { LiveLineStrip, AlertsDock } from '../components/RealtimePanel';
import { InfoIcon } from '../components/InfoIcon';
import { SCENARIO_LABEL, scenarioColor, fmt } from '../lib/format';
import type { EventSummary } from '../lib/types';

export function Overview({ onNavigate }: { onNavigate: (p: 'process') => void }) {
  const overview = useAsync(() => api.overview());
  const compare = useAsync(() => api.compare());
  const events = useAsync(() => api.events(200));

  if (overview.loading || !overview.data)
    return overview.error ? <ErrorState error={overview.error} onRetry={overview.reload} /> : <Loading label="加载驾驶舱数据" />;
  const o = overview.data;
  const evs = events.data?.items ?? [];
  const sample = evs.filter((_, i) => i % Math.max(1, Math.floor(evs.length / 40)) === 0).slice(0, 40);

  const scenarioCount = evs.reduce<Record<string, number>>((acc, e) => {
    acc[e.scenario] = (acc[e.scenario] ?? 0) + 1;
    return acc;
  }, {});
  const donutData = Object.entries(scenarioCount)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: SCENARIO_LABEL[k] ?? k, value: v, color: scenarioColor(k) }));

  const targetHit = o.avgChangeoverMinutes <= o.targetChangeoverMinutes[1] && o.oee >= 80;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="banner">
        <div>
          <h3>多智能体协同换产引擎运行正常，核心指标持续稳定达标</h3>
          <p>
            在 {o.timeSpanDays} 天仿真范围内完成 {o.totalEvents} 次换产，平均换产时间由传统模式
            {fmt(o.baselineChangeoverMinutes)} 分钟降至 <b>{fmt(o.avgChangeoverMinutes)} 分钟</b>，
            OEE 由 {fmt(o.baselineOee)}% 提升至 <b>{fmt(o.oee)}%</b>。
          </p>
        </div>
        <Badge color={targetHit ? '#10b981' : '#f59e0b'}>{targetHit ? '目标达成' : '接近目标'}</Badge>
      </div>
      <div className="grid cols-5">
        <KpiCard label="平均换产时间" value={fmt(o.avgChangeoverMinutes)} unit="min"
          trend={`目标 ${o.targetChangeoverMinutes[0]}-${o.targetChangeoverMinutes[1]} 分钟`} trendGood
          progress={(o.baselineChangeoverMinutes - o.avgChangeoverMinutes) / o.baselineChangeoverMinutes * 100} color="#22d3ee"
          helpKey="avg_changeover_minutes" />
        <KpiCard label="设备综合效率 OEE" value={fmt(o.oee)} unit="%"
          trend={`基线 ${fmt(o.baselineOee)}%，目标 ≥80%`} trendGood progress={o.oee} color="#10b981"
          helpKey="oee" />
        <KpiCard label="换产周期缩短" value={fmt(o.reductionRatio)} unit="%"
          trend={`平均节省 ${fmt(o.baselineChangeoverMinutes - o.avgChangeoverMinutes)} 分钟/次`} trendGood progress={o.reductionRatio} color="#4f8cff"
          helpKey="reduction_ratio" />
        <KpiCard label="人员效率优化" value={`-${o.operatorReduction}`} unit="%"
          trend={`${o.operatorsBaseline} 人 → ${o.operatorsOptimized} 人`} trendGood progress={o.operatorReduction * 4} color="#a855f7"
          helpKey="operator_reduction" />
        <KpiCard label="首件检验合格率" value={fmt(o.qualityPassRate)} unit="%"
          trend={`调度准确率 ${fmt(o.schedulingAccuracy)}%`} trendGood progress={o.qualityPassRate} color="#06b6d4"
          helpKey="quality_pass_rate" />
      </div>

      <div className="grid cols-2">
        <Panel title="换产时间趋势：传统模式 vs 多智能体协同"
          sub="横轴为换产事件序号，虚线为换产时长目标上限 18 分钟"
          helpKey="baseline_minutes">
          <LineChart
            yUnit="′"
            targetLine={{ value: 18, label: '目标 18 分钟' }}
            series={[
              { name: '传统模式', color: '#6b7c9e', points: sample.map((e) => e.baselineMinutes), dashed: true },
              { name: '多智能体协同', color: '#22d3ee', points: sample.map((e) => e.actualMinutes) },
            ]}
            labels={sample.map((e) => e.sequence)}
          />
          <div className="legend" style={{ marginTop: 8 }}>
            <span><span className="dot" style={{ background: '#6b7c9e' }} />传统串行计划</span>
            <span><span className="dot" style={{ background: '#22d3ee' }} />多智能体协同</span>
          </div>
        </Panel>

        <Panel title="OEE 达成情况" sub="黄色标记为 OEE 目标 80%" helpKey="oee">
          <div className="grid cols-2" style={{ alignItems: 'center' }}>
            <Gauge value={o.oee} target={80} label="协同模式 OEE %" color="#10b981" />
            <div>
              <div className="kv"><span>传统模式 OEE</span><b>{fmt(o.baselineOee)}%</b></div>
              <div className="kv"><span>协同模式 OEE</span><b style={{ color: '#10b981' }}>{fmt(o.oee)}%</b></div>
              <div className="kv"><span>OEE 提升</span><b style={{ color: '#10b981' }}>+{fmt(o.oee - o.baselineOee)} 个百分点</b></div>
              <div className="kv"><span>异常场景占比 <InfoIcon helpKey="exception_rate" inline /></span><b>{fmt(o.exceptionRate)}%</b></div>
              <div className="kv"><span>目标值</span><b>≥80%</b></div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid cols-2">
        <Panel title="核心指标对比" sub="传统人工经验模式 vs 多智能体协同模式" helpKey="baseline_oee">
          {compare.data && (
            <BarCompare items={[
              { label: '换产时间(分)', before: compare.data.baseline.changeoverMinutes, after: compare.data.optimized.changeoverMinutes, better: 'low' },
              { label: 'OEE(%)', before: compare.data.baseline.oee, after: compare.data.optimized.oee, better: 'high' },
              { label: '作业人数', before: compare.data.baseline.operators, after: compare.data.optimized.operators, better: 'low' },
            ]} />
          )}
        </Panel>
        <Panel title="换产场景分布" sub="覆盖正常场景与各类异常场景" helpKey="scenario_normal">
          <Donut data={donutData} />
        </Panel>
      </div>

      <LiveLineStrip />
      <AlertsDock />

      <Panel title="最新换产事件" sub={`共 ${o.totalEvents} 次，展示最近 10 次`}
        helpKey="saved_minutes"
        right={<button className="btn ghost" onClick={() => onNavigate('process')}>查看流程详情</button>}>
        <DataTable<EventSummary>
          keyField={(r) => r.id}
          rows={evs.slice(-10).reverse()}
          columns={[
            { key: 'sequence', title: '序号', render: (r) => `#${r.sequence}` },
            { key: 'line', title: '产线' },
            { key: 'route', title: '产品切换', render: (r) => <span className="mono">{r.fromProduct} → {r.toProduct}</span> },
            { key: 'scenario', title: '场景', render: (r) => <Badge color={scenarioColor(r.scenario)}>{SCENARIO_LABEL[r.scenario]}</Badge> },
            { key: 'baselineMinutes', title: '传统', render: (r) => `${fmt(r.baselineMinutes)}′` },
            { key: 'actualMinutes', title: '协同', render: (r) => <b style={{ color: '#22d3ee' }}>{fmt(r.actualMinutes)}′</b> },
            { key: 'savedRatio', title: '节省', render: (r) => <span style={{ color: '#10b981' }}>{fmt(r.savedRatio)}%</span> },
            { key: 'oeeAfter', title: 'OEE', render: (r) => `${fmt(r.oeeAfter)}%` },
            { key: 'success', title: '状态', render: (r) => <Badge color={r.success ? '#10b981' : '#f59e0b'}>{r.success ? '达标' : '观察'}</Badge> },
          ]}
        />
      </Panel>
    </div>
  );
}
