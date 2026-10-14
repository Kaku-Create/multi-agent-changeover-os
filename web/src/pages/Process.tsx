import React from 'react';
import { api } from '../lib/api';
import { useAsync, Loading, ErrorState } from '../lib/useAsync';
import { Panel, Badge, DataTable } from '../components/ui';
import { GanttCompare } from '../components/Gantt';
import { MessageStream } from '../components/AgentWidgets';
import { InfoIcon } from '../components/InfoIcon';
import { AGENT_COLOR, AGENT_LABEL, SCENARIO_LABEL, scenarioColor, fmt } from '../lib/format';
import type { ChangeoverEvent, ChangeoverTask } from '../lib/types';

export function Process() {
  const events = useAsync(() => api.events(200));
  const products = useAsync(() => api.products());
  const scenarios = useAsync(() => api.scenarios());

  const evList = events.data?.items ?? [];
  const [selected, setSelected] = React.useState<string | null>(null);
  const [live, setLive] = React.useState<ChangeoverEvent | null>(null);
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [scenario, setScenario] = React.useState('normal');
  const [running, setRunning] = React.useState(false);

  const currentId = selected ?? (evList.length ? evList[evList.length - 1].id : null);
  const detail = useAsync(() => (currentId ? api.event(currentId) : Promise.resolve(null)), [currentId]);

  const event = live ?? detail.data;

  React.useEffect(() => {
    if (products.data && !from) {
      setFrom(products.data.items[0]?.code ?? '');
      setTo(products.data.items[1]?.code ?? products.data.items[0]?.code ?? '');
    }
  }, [products.data]);

  const run = async () => {
    setRunning(true);
    try {
      const e = await api.simulate({ from, to, scenario });
      setLive(e);
    } finally {
      setRunning(false);
    }
  };

  if (events.loading)
    return events.error ? <ErrorState error={events.error} onRetry={events.reload} /> : <Loading label="加载换产流程" />;

  const baseline = event?.timeline.filter((t) => t.taskId.startsWith('B-')) ?? [];
  const tasks: ChangeoverTask[] = event?.schedule.tasks ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Panel title="换产仿真沙盘" sub="选择历史事件，或实时运行一次带异常注入的换产仿真">
        <div className="controls">
          <label className="field">历史事件
            <select value={currentId ?? ''} onChange={(e) => { setSelected(e.target.value); setLive(null); }}>
              {evList.slice(-40).reverse().map((e) => (
                <option key={e.id} value={e.id}>#{e.sequence} {e.fromProduct}→{e.toProduct}（{SCENARIO_LABEL[e.scenario]}）</option>
              ))}
            </select>
          </label>
          <label className="field">起始产品
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {products.data?.items.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
            </select>
          </label>
          <label className="field">目标产品
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {products.data?.items.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
            </select>
          </label>
          <label className="field">注入场景
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {scenarios.data?.items.map((s) => <option key={s.type} value={s.type}>{s.name}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={run} disabled={running} style={{ alignSelf: 'flex-end' }}>
            {running ? '仿真运行中...' : '运行换产仿真'}
          </button>
          {live && <button className="btn ghost" style={{ alignSelf: 'flex-end' }} onClick={() => setLive(null)}>返回历史</button>}
        </div>
      </Panel>

      {!event ? <Loading /> : (
        <>
          <div className="grid cols-4">
            <div className="panel">
              <div className="kpi-label">切换产品 <InfoIcon helpKey="product_count" inline /></div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }} className="mono">{event.fromProduct} → {event.toProduct}</div>
              <div style={{ marginTop: 8 }}><Badge color={scenarioColor(event.scenario)}>{SCENARIO_LABEL[event.scenario]}</Badge></div>
            </div>
            <div className="panel">
              <div className="kpi-label">换产耗时 <InfoIcon helpKey="actual_minutes" inline /></div>
              <div className="kpi-value" style={{ fontSize: 24 }}>{fmt(event.actualMinutes)}<span className="unit">min</span></div>
              <div className="kpi-trend">传统 {fmt(event.baselineMinutes)}′ · 节省 <span className="good">{fmt(event.savedRatio)}%</span></div>
            </div>
            <div className="panel">
              <div className="kpi-label">并行度 / 任务数 <InfoIcon helpKey="parallelism" inline /></div>
              <div className="kpi-value" style={{ fontSize: 24 }}>{event.schedule.parallelism}<span className="unit">路并行</span></div>
              <div className="kpi-trend">{tasks.length} 个换产任务协同执行</div>
            </div>
            <div className="panel">
              <div className="kpi-label">责任瓶颈 <InfoIcon helpKey="bottleneck" inline /></div>
              <div className="kpi-value" style={{ fontSize: 18, marginTop: 6 }}>{event.bottleneck}</div>
              <div className="kpi-trend">关键路径 {event.schedule.criticalPath.length} 步</div>
            </div>
          </div>

          <Panel title="换产任务时序甘特图" sub="灰色为传统串行计划，彩色为多智能体协同实际执行（白边为关键任务）" helpKey="parallelism">
            <GanttCompare tasks={tasks} baseline={baseline.map((b) => ({ name: b.name, start: b.baselineStart, end: b.baselineEnd }))} />
            <div className="legend" style={{ marginTop: 14 }}>
              {(Object.keys(AGENT_COLOR) as (keyof typeof AGENT_COLOR)[]).map((a) => (
                <span key={a}><span className="dot" style={{ background: AGENT_COLOR[a] }} />{AGENT_LABEL[a]}</span>
              ))}
            </div>
          </Panel>

          <div className="grid cols-2">
            <Panel title="关键路径与任务明细" sub="按执行时序排列" helpKey="critical_path">
              <DataTable<ChangeoverTask>
                keyField={(r) => r.id}
                rows={tasks}
                columns={[
                  { key: 'name', title: '任务', render: (r) => (
                    <span style={{ color: r.isCritical ? '#22d3ee' : undefined, fontWeight: r.isCritical ? 700 : 400 }}>
                      {r.isCritical ? '★ ' : ''}{r.name}
                    </span>
                  ) },
                  { key: 'agent', title: '责任智能体', render: (r) => AGENT_LABEL[r.agent] },
                  { key: 'resource', title: '资源' },
                  { key: 'start', title: '开始', render: (r) => `${fmt(r.start)}′` },
                  { key: 'end', title: '结束', render: (r) => `${fmt(r.end)}′` },
                  { key: 'duration', title: '耗时', render: (r) => `${fmt(r.duration)}′` },
                ]}
              />
              <div style={{ marginTop: 12 }}>
                <div className="muted">关键路径：</div>
                <div className="controls" style={{ marginTop: 6 }}>
                  {event.schedule.criticalPath.map((c, i) => {
                    const t = tasks.find((x) => x.step === c);
                    return (
                      <React.Fragment key={c}>
                        {i > 0 && <span className="muted">→</span>}
                        <span className="pill" style={{ borderColor: '#22d3ee66', color: '#a5f3fc' }}>{t?.name ?? c}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <Panel title="智能体协同决策流" sub="实时协商与纠偏记录" helpKey="agent_capabilities">
              <MessageStream messages={event.messages} height={460} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
