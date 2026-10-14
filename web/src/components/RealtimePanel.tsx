import React from 'react';
import { useRealtime } from '../lib/realtime';
import { Panel, Badge } from './ui';
import { scenarioColor, SCENARIO_LABEL } from '../lib/format';

export function LiveLineStrip() {
  const { lines, connected } = useRealtime();
  if (!lines.length) {
    return (
      <Panel title="产线实时状态" sub="通过 SSE 实时推送">
        <div className="empty">
          {connected ? '等待实时数据...' : '实时连接建立中...'}
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      title="产线实时状态"
      sub="通过 SSE 实时推送，每 3 秒刷新"
      right={<Badge color={connected ? '#10b981' : '#ef4444'}>{connected ? '实时在线' : '连接中断'}</Badge>}
    >
      <div className="grid cols-3">
        {lines.map((l) => {
          const running = l.status === 'changeover';
          const color = running ? '#f59e0b' : '#10b981';
          return (
            <div key={l.line} className="panel" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>{l.line}</b>
                <Badge color={color}>{running ? '换产中' : '运行中'}</Badge>
              </div>
              <div className="kv" style={{ marginTop: 8 }}>
                <span>当前产品</span><b className="mono">{l.currentProduct ?? '-'}</b>
              </div>
              <div className="kv"><span>OEE</span><b>{l.oee}%</b></div>
              {l.activeChangeover && (
                <div className="kv"><span>换产事件</span><b className="mono">{l.activeChangeover}</b></div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function ChangeoverProgressBanner() {
  const { progress } = useRealtime();
  if (!progress) return null;
  return (
    <div className="banner" style={{ borderColor: '#22d3ee55' }}>
      <div style={{ flex: 1 }}>
        <h3>
          实时换产 #{progress.eventId}：{progress.fromProduct} → {progress.toProduct}
          <span style={{ marginLeft: 10, fontSize: 12 }}>
            <Badge color={scenarioColor(progress.scenario)}>{SCENARIO_LABEL[progress.scenario] ?? progress.scenario}</Badge>
          </span>
        </h3>
        <p>{progress.message}</p>
        <div className="progress" style={{ marginTop: 10 }}>
          <span style={{ width: `${progress.progress}%`, background: 'linear-gradient(90deg,#22d3ee,#4f8cff)' }} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#22d3ee', minWidth: 70, textAlign: 'right' }}>
        {progress.progress}%
      </div>
    </div>
  );
}

export function AlertsDock() {
  const { alerts } = useRealtime();
  if (!alerts.length) return null;
  const color = (lvl: string) => (lvl === 'error' ? '#ef4444' : lvl === 'warn' ? '#f59e0b' : '#22d3ee');
  return (
    <Panel title="实时告警" sub="来自智能体协同引擎">
      <div className="scroll-y" style={{ maxHeight: 240 }}>
        {alerts.map((a, i) => (
          <div className="msg" key={i} style={{ borderColor: `${color(a.level)}55` }}>
            <span className="msg-from" style={{ color: color(a.level) }}>{a.level.toUpperCase()}</span>
            <span className="msg-body">
              <b>{a.title}</b>
              <div className="muted">{a.detail}</div>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
