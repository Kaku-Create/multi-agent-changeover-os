import React from 'react';
import type { AgentMessage, AgentState } from '../lib/types';
import { AGENT_COLOR, AGENT_LABEL } from '../lib/format';
import { InfoIcon } from './InfoIcon';

const MONOGRAM: Record<string, string> = {
  scheduling: '调',
  equipment: '设',
  material: '料',
  tooling: '工',
  quality: '质',
  employee: '人',
};

export function AgentCard({ agent }: { agent: AgentState }) {
  const color = AGENT_COLOR[agent.type];
  return (
    <div className="panel agent-card">
      <div className="agent-top">
        <div className="agent-avatar" style={{ background: `linear-gradient(135deg, ${color}, #0b1020)` }}>
          {MONOGRAM[agent.type]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="agent-name">{agent.name}</div>
          <div className="agent-role">负载 {agent.load}% · {agent.lastAction.slice(0, 26)}</div>
        </div>
        <span className="badge" style={{ marginLeft: 'auto', color, borderColor: `${color}66`, background: `${color}18` }}>
          <span className="dot" style={{ background: color }} />在线
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${agent.load}%`, background: `linear-gradient(90deg, ${color}, #22d3ee)` }} />
      </div>
      <div className="agent-stats">
        <div className="agent-stat"><b>{agent.decisionCount}</b><span>决策次数<InfoIcon helpKey="agent_decision_count" inline /></span></div>
        <div className="agent-stat"><b style={{ color: '#10b981' }}>{agent.successCount}</b><span>成功协同<InfoIcon helpKey="agent_success_count" inline /></span></div>
        <div className="agent-stat"><b style={{ color: agent.alertCount ? '#f59e0b' : '#6b7c9e' }}>{agent.alertCount}</b><span>异常处置<InfoIcon helpKey="agent_alert_count" inline /></span></div>
      </div>
      <div className="cap-tags" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 11, marginRight: 6 }}>能力：</span>
        {agent.capabilities.map((c) => <span className="cap-tag" key={c}>{c}</span>)}
        <InfoIcon helpKey="agent_capabilities" />
      </div>
    </div>
  );
}

export function MessageStream({ messages, height = 520 }: { messages: AgentMessage[]; height?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length]);
  if (!messages.length) return <div className="empty">暂无协同消息，启动一次换产仿真以查看智能体协商过程</div>;
  return (
    <div className="stream" ref={ref} style={{ maxHeight: height }}>
      {messages.map((m) => (
        <div className="msg" key={m.id}>
          <span className="msg-from" style={{ color: AGENT_COLOR[m.from] }}>{AGENT_LABEL[m.from]}</span>
          <span className="msg-kind">{m.kind}</span>
          <span className="msg-body">{m.content}</span>
          <span className="msg-time">T+{m.timestamp}′</span>
        </div>
      ))}
    </div>
  );
}
