import React from 'react';
import { api } from '../lib/api';
import { useAsync, Loading, ErrorState } from '../lib/useAsync';
import { Panel, Badge } from '../components/ui';
import { AgentCard, MessageStream } from '../components/AgentWidgets';
import { InfoIcon } from '../components/InfoIcon';
import { AGENT_COLOR, AGENT_LABEL, SCENARIO_LABEL, scenarioColor, fmt } from '../lib/format';
import type { AgentType } from '../lib/types';

const RADIAL: AgentType[] = ['equipment', 'material', 'tooling', 'quality', 'employee'];

function Topology({ activeAgent }: { activeAgent: AgentType | null }) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const r = 150;
  const center = { x: cx, y: cy };
  const nodes = RADIAL.map((t, i) => {
    const angle = -Math.PI / 2 + (i / RADIAL.length) * Math.PI * 2;
    return { type: t, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxHeight: 420 }}>
      {nodes.map((n) => (
        <line key={n.type} x1={center.x} y1={center.y} x2={n.x} y2={n.y}
          stroke={activeAgent === n.type ? AGENT_COLOR[n.type] : 'rgba(120,150,210,0.28)'}
          strokeWidth={activeAgent === n.type ? 2.4 : 1.2}
          strokeDasharray={activeAgent === n.type ? '6 4' : undefined} />
      ))}
      <circle cx={center.x} cy={center.y} r={42} fill="rgba(99,102,241,0.16)" stroke="#6366f1" strokeWidth={2} />
      <text x={center.x} y={center.y - 4} textAnchor="middle" fill="#c7d2fe" fontSize={13} fontWeight={700}>调度</text>
      <text x={center.x} y={center.y + 13} textAnchor="middle" fill="#c7d2fe" fontSize={13} fontWeight={700}>智能体</text>
      {nodes.map((n) => (
        <g key={n.type}>
          <circle cx={n.x} cy={n.y} r={34} fill={`${AGENT_COLOR[n.type]}26`} stroke={AGENT_COLOR[n.type]} strokeWidth={2} />
          <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#e8eefc" fontSize={12} fontWeight={700}>
            {AGENT_LABEL[n.type].replace('智能体', '')}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Agents() {
  const agents = useAsync(() => api.agents());
  const events = useAsync(() => api.events(200));
  const [selected, setSelected] = React.useState<string | null>(null);
  const [activeAgent, setActiveAgent] = React.useState<AgentType | null>(null);

  const evList = events.data?.items ?? [];
  const currentId = selected ?? (evList.length ? evList[evList.length - 1].id : null);
  const detail = useAsync(
    () => (currentId ? api.event(currentId) : Promise.resolve(null)),
    [currentId],
  );

  if (agents.loading || !agents.data)
    return agents.error ? <ErrorState error={agents.error} onRetry={agents.reload} /> : <Loading label="加载智能体状态" />;
  const msgs = detail.data?.messages ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-3">
        {agents.data.items.map((a) => <AgentCard key={a.type} agent={a} />)}
      </div>

      <div className="grid cols-2">
        <Panel title="协同拓扑与信息流" sub="调度智能体作为大脑，与五类专业智能体双向协商"
          right={
            <div className="legend">
              {RADIAL.map((t) => (
                <span key={t} onMouseEnter={() => setActiveAgent(t)} onMouseLeave={() => setActiveAgent(null)}
                  style={{ cursor: 'pointer' }}>
                  <span className="dot" style={{ background: AGENT_COLOR[t] }} />{AGENT_LABEL[t].replace('智能体', '')}
                </span>
              ))}
            </div>
          }>
          <Topology activeAgent={activeAgent} />
          <div className="muted" style={{ textAlign: 'center', marginTop: 4 }}>
            悬停节点可高亮该智能体的协同链路
          </div>
        </Panel>

        <Panel title="智能体协商决策流"
          sub={detail.data ? `换产事件 ${detail.data.id}（${SCENARIO_LABEL[detail.data.scenario]}）` : '选择事件查看'}
          right={
            <select value={currentId ?? ''} onChange={(e) => setSelected(e.target.value)}>
              {evList.slice(-30).reverse().map((e) => (
                <option key={e.id} value={e.id}>#{e.sequence} {e.fromProduct}→{e.toProduct}</option>
              ))}
            </select>
          }>
          {detail.loading ? <Loading /> : <MessageStream messages={msgs} height={520} />}
        </Panel>
      </div>

      {detail.data && (
        <Panel title="本次换产协同成效" sub="智能体协同后的量化结果" helpKey="makespan">
          <div className="grid cols-4">
            <div className="kv" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>场景 <InfoIcon helpKey="scenario_normal" inline /></span><b><Badge color={scenarioColor(detail.data.scenario)}>{SCENARIO_LABEL[detail.data.scenario]}</Badge></b>
            </div>
            <div className="kv" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>换产耗时（传统 → 协同）<InfoIcon helpKey="actual_minutes" inline /></span><b>{fmt(detail.data.baselineMinutes)}′ → <span style={{ color: '#22d3ee' }}>{fmt(detail.data.actualMinutes)}′</span></b>
            </div>
            <div className="kv" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>OEE（前 → 后）<InfoIcon helpKey="oee_after" inline /></span><b>{fmt(detail.data.oeeBefore)}% → <span style={{ color: '#10b981' }}>{fmt(detail.data.oeeAfter)}%</span></b>
            </div>
            <div className="kv" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>瓶颈环节 <InfoIcon helpKey="bottleneck" inline /></span><b>{detail.data.bottleneck}</b>
            </div>
          </div>
          {detail.data.deviations.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {detail.data.deviations.map((d, i) => (
                <div className="msg" key={i} style={{ borderColor: '#f59e0b55' }}>
                  <span className="msg-from" style={{ color: '#f59e0b' }}>偏差纠偏 <InfoIcon helpKey="deviation" inline /></span>
                  <span className="msg-body">{d.description}，偏差 {fmt(d.deltaMinutes)} 分钟。{d.resolution}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
