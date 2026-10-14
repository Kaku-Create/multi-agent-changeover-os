import React from 'react';
import { InfoIcon } from './InfoIcon';
import type { HelpKey } from '../lib/dataGlossary';

export function Panel({
  title,
  sub,
  right,
  helpKey,
  children,
  className = '',
  style,
}: {
  title?: string;
  sub?: string;
  right?: React.ReactNode;
  helpKey?: HelpKey;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`panel ${className}`} style={style}>
      {(title || right) && (
        <div className="panel-head">
          <div>
            <div className="panel-title">
              {title}
              {helpKey && <InfoIcon helpKey={helpKey} />}
            </div>
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  trend,
  trendGood = true,
  progress,
  color = '#4f8cff',
  helpKey,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendGood?: boolean;
  progress?: number;
  color?: string;
  helpKey?: HelpKey;
}) {
  return (
    <div className="panel kpi">
      <div className="glow" style={{ background: `radial-gradient(circle, ${color}55, transparent 70%)` }} />
      <div className="kpi-label">
        {label}
        {helpKey && <InfoIcon helpKey={helpKey} />}
      </div>
      <div className="kpi-value" style={{ color: '#fff' }}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {trend && (
        <div className="kpi-trend">
          <span className={trendGood ? 'good' : 'bad'}>{trendGood ? '▲' : '▼'}</span>
          <span>{trend}</span>
        </div>
      )}
      {progress !== undefined && (
        <div className="kpi-bar">
          <span style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: `linear-gradient(90deg, ${color}, #22d3ee)` }} />
        </div>
      )}
    </div>
  );
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="badge" style={{ color, borderColor: `${color}66`, background: `${color}18` }}>
      <span className="dot" style={{ background: color }} />
      {children}
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  keyField,
  empty = '暂无数据',
}: {
  columns: { key: string; title: string; render?: (row: T) => React.ReactNode; width?: string }[];
  rows: T[];
  keyField: (row: T, i: number) => string;
  empty?: string;
}) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyField(row, i)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '-')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Progress({ value, color = '#22d3ee' }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}
