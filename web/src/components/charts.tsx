import React from 'react';

export function Gauge({
  value,
  max = 100,
  target,
  label,
  color = '#22d3ee',
  size = 150,
}: {
  value: number;
  max?: number;
  target?: number;
  label?: string;
  color?: string;
  size?: number;
}) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const ratio = Math.max(0, Math.min(1, value / max));
  const targetRatio = target !== undefined ? Math.max(0, Math.min(1, target / max)) : undefined;
  const polar = (frac: number) => {
    const angle = Math.PI - frac * Math.PI;
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  };
  const start = polar(0);
  const end = polar(ratio);
  const t = targetRatio !== undefined ? polar(targetRatio) : null;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size * 0.66} viewBox={`0 0 ${size} ${size * 0.66}`}>
        <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${polar(1).x} ${polar(1).y}`}
          fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={12} strokeLinecap="round" />
        <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
        {t && (
          <circle cx={t.x} cy={t.y} r={5} fill="#f59e0b" stroke="#0b1020" strokeWidth={2} />
        )}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#e8eefc" fontSize={26} fontWeight={800}>
          {value.toFixed(1)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#6b7c9e" fontSize={11}>
          {label ?? ''}
        </text>
      </svg>
    </div>
  );
}

interface Series {
  name: string;
  color: string;
  points: number[];
  dashed?: boolean;
}

export function LineChart({
  series,
  labels,
  height = 220,
  yMin,
  yMax,
  targetLine,
  yUnit = '',
}: {
  series: Series[];
  labels: (number | string)[];
  height?: number;
  yMin?: number;
  yMax?: number;
  targetLine?: { value: number; label: string; color?: string };
  yUnit?: string;
}) {
  const width = 720;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const all = series.flatMap((s) => s.points);
  const lo = yMin ?? Math.min(...all);
  const hi = yMax ?? Math.max(...all);
  const range = hi - lo || 1;
  const x = (i: number, n: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - lo) / range) * innerH;
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => lo + (range * i) / ticks);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke="rgba(120,150,210,0.12)" strokeWidth={1} />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fill="#6b7c9e" fontSize={10}>
            {v.toFixed(0)}{yUnit}
          </text>
        </g>
      ))}
      {targetLine && (
        <g>
          <line x1={padL} x2={width - padR} y1={y(targetLine.value)} y2={y(targetLine.value)}
            stroke={targetLine.color ?? '#f59e0b'} strokeWidth={1.2} strokeDasharray="5 4" />
          <text x={width - padR - 4} y={y(targetLine.value) - 4} textAnchor="end" fill={targetLine.color ?? '#f59e0b'} fontSize={10}>
            {targetLine.label}
          </text>
        </g>
      )}
      {series.map((s) => {
        const d = s.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i, s.points.length).toFixed(1)} ${y(p).toFixed(1)}`)
          .join(' ');
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={2.2}
              strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
            {s.points.length <= 24 &&
              s.points.map((p, i) => <circle key={i} cx={x(i, s.points.length)} cy={y(p)} r={2.6} fill={s.color} />)}
          </g>
        );
      })}
      {labels.map((lb, i) => {
        const step = Math.ceil(labels.length / 8);
        if (i % step !== 0 && i !== labels.length - 1) return null;
        return (
          <text key={i} x={x(i, labels.length)} y={height - 8} textAnchor="middle" fill="#6b7c9e" fontSize={10}>
            {lb}
          </text>
        );
      })}
      <line x1={padL} x2={width - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(120,150,210,0.25)" />
    </svg>
  );
}

export function BarCompare({
  items,
  height = 200,
}: {
  items: { label: string; before: number; after: number; unit?: string; better?: 'low' | 'high' }[];
  height?: number;
}) {
  const max = Math.max(...items.flatMap((i) => [i.before, i.after])) * 1.15 || 1;
  const colors = { before: '#6b7c9e', after: '#22d3ee' };
  return (
    <div style={{ display: 'flex', gap: 26, alignItems: 'flex-end', justifyContent: 'space-around', height, padding: '0 8px' }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: height - 52 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.before }}>{it.before}{it.unit}</span>
              <div style={{ width: 30, height: `${(it.before / max) * (height - 76)}px`, background: colors.before, borderRadius: '6px 6px 0 0' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.after }}>{it.after}{it.unit}</span>
              <div style={{ width: 30, height: `${(it.after / max) * (height - 76)}px`, background: `linear-gradient(180deg, ${colors.after}, #4f8cff)`, borderRadius: '6px 6px 0 0' }} />
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  data,
  size = 150,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14} />
        {data.map((d) => {
          const len = (d.value / total) * circumference;
          const el = (
            <circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={14}
              strokeDasharray={`${len} ${circumference - len}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#e8eefc" fontSize={22} fontWeight={800}>{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fill="#6b7c9e" fontSize={10}>换产事件</text>
      </svg>
      <div className="donut-legend">
        {data.map((d) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot" style={{ background: d.color }} />
            <span>{d.label}</span>
            <b style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{d.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
