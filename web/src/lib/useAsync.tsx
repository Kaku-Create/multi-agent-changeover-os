import React from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export function Loading({ label = '加载中' }: { label?: string }) {
  return (
    <div className="empty">
      <span className="spin" /> <span style={{ marginLeft: 8 }}>{label}...</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 8 }}>数据加载失败</div>
      <div className="muted">{error}</div>
      {onRetry && (
        <button className="btn primary" style={{ marginTop: 14 }} onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}

