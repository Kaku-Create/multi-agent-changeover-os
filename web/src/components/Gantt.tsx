import React from 'react';
import type { ChangeoverTask } from '../lib/types';
import { AGENT_COLOR } from '../lib/format';

export function GanttCompare({
  tasks,
  baseline,
}: {
  tasks: ChangeoverTask[];
  baseline: { name: string; start: number; end: number }[];
}) {
  const max = Math.max(
    ...tasks.map((t) => t.end),
    ...baseline.map((b) => b.end),
    1,
  );
  const pct = (v: number) => (v / max) * 100;

  return (
    <div>
      <div className="legend" style={{ marginBottom: 12 }}>
        <span><span className="dot" style={{ background: '#6b7c9e' }} />传统串行计划</span>
        <span><span className="dot" style={{ background: '#22d3ee' }} />多智能体协同实际</span>
        <span className="muted">横轴：换产耗时（分钟），总时长 {max.toFixed(1)} 分钟</span>
      </div>
      {tasks.map((t) => {
        const b = baseline.find((x) => x.name === t.name);
        return (
          <div className="gantt-row" key={t.id}>
            <div className="gantt-label" title={t.name}>{t.name}</div>
            <div className="gantt-track">
              {b && (
                <div className="gantt-bar baseline" style={{ left: `${pct(b.start)}%`, width: `${Math.max(0.5, pct(b.end - b.start))}%` }} />
              )}
              <div
                className="gantt-bar"
                title={`${t.name} ${t.start}-${t.end}分`}
                style={{
                  left: `${pct(t.start)}%`,
                  width: `${Math.max(0.8, pct(t.end - t.start))}%`,
                  background: AGENT_COLOR[t.agent],
                  top: 3,
                  height: 11,
                  opacity: t.isCritical ? 1 : 0.72,
                  border: t.isCritical ? '1px solid #fff' : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="gantt-axis">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{((max * i) / 6).toFixed(1)}</span>
        ))}
      </div>
    </div>
  );
}
