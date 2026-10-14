import React from 'react';
import './styles.css';
import { Overview } from './pages/Overview';
import { Agents } from './pages/Agents';
import { Process } from './pages/Process';
import { DataCenter } from './pages/DataCenter';
import { DataIO } from './pages/DataIO';
import { Learning } from './pages/Learning';
import { About } from './pages/About';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChangeoverProgressBanner } from './components/RealtimePanel';
import { RealtimeProvider, useRealtime } from './lib/realtime';
import { HelpProvider, useHelpToggle } from './lib/helpContext';
import { api } from './lib/api';
import type { OverviewMetrics, LearningRecord } from './lib/types';

type PageKey = 'overview' | 'agents' | 'process' | 'data' | 'dataio' | 'learning' | 'about';

const NAV: { key: PageKey; label: string; icon: string; title: string; desc: string }[] = [
  { key: 'overview', label: '总览驾驶舱', icon: '◈', title: '总览驾驶舱', desc: '换产全生命周期关键指标与协同态势' },
  { key: 'agents', label: '多智能体协同', icon: '⬡', title: '多智能体协同中心', desc: '六类智能体实时状态与协商决策流' },
  { key: 'process', label: '换产流程', icon: '▤', title: '换产流程与动态调度', desc: '任务时序、关键路径与偏差纠偏' },
  { key: 'data', label: '数据资产', icon: '⧉', title: '数据资产浏览', desc: 'BOM/物料/设备/人员数据资产' },
  { key: 'dataio', label: '数据接入', icon: '⇪', title: '数据接入与系统治理', desc: '真实数据导入、数据集生成、导入记录与审计日志' },
  { key: 'learning', label: '学习与优化', icon: '✦', title: '自学习与持续优化', desc: '策略参数自学习、瓶颈识别与模板沉淀' },
  { key: 'about', label: '系统说明', icon: '❖', title: '系统介绍与总体架构', desc: '系统价值、智能体能力、架构与部署运行' },
];

function Shell() {
  const [page, setPage] = React.useState<PageKey>('overview');
  const [now, setNow] = React.useState(new Date());
  const realtime = useRealtime();
  const help = useHelpToggle();

  React.useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const [ov, learn] = await Promise.all([
          api.overview().catch(() => null) as Promise<OverviewMetrics | null>,
          api.learning().catch(() => null) as Promise<{ items: LearningRecord[] } | null>,
        ]);
        if (!mounted) return;
        help.setDynamic({
          overview: ov ?? undefined,
          records: learn?.items ?? undefined,
        });
      } catch {
        /* swallow */
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [help.setDynamic]);

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const current = NAV.find((n) => n.key === page)!;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">换</div>
          <div>
            <div className="brand-title">智能换产协同平台</div>
            <div className="brand-sub">Multi-Agent Changeover OS</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <div key={n.key} className={`nav-item ${page === n.key ? 'active' : ''}`} onClick={() => setPage(n.key)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          智能换产协同平台 V2.0<br />
          多智能体 · 动态调度 · 全程可观测<br />
          <span className="mono">{now.toLocaleTimeString('zh-CN')}</span>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="page-title">{current.title}</div>
            <div className="page-desc">{current.desc}</div>
          </div>
          <div className="topbar-actions">
            <div className="help-toggle" title="切换数据说明详细程度">
              <button
                className={`help-toggle-btn ${help.level === 'brief' ? 'active' : ''}`}
                onClick={() => help.setLevel('brief')}
              >
                简略
              </button>
              <button
                className={`help-toggle-btn ${help.level === 'detailed' ? 'active' : ''}`}
                onClick={() => help.setLevel('detailed')}
              >
                详细
              </button>
            </div>
            <span className="pill">生产模式</span>
            <span className="badge" style={{
              color: realtime.connected ? '#10b981' : '#f59e0b',
              borderColor: realtime.connected ? '#10b98166' : '#f59e0b66',
              background: realtime.connected ? '#10b98118' : '#f59e0b18',
            }}>
              <span className="dot" style={{ background: realtime.connected ? '#10b981' : '#f59e0b' }} />
              {realtime.connected ? '实时连接正常' : '实时重连中'}
            </span>
          </div>
        </header>
        <div className="content">
          {realtime.progress && (
            <div style={{ marginBottom: 16 }}>
              <ChangeoverProgressBanner />
            </div>
          )}
          <ErrorBoundary>
            {page === 'overview' && <Overview onNavigate={setPage} />}
            {page === 'agents' && <Agents />}
            {page === 'process' && <Process />}
            {page === 'data' && <DataCenter />}
            {page === 'dataio' && <DataIO />}
            {page === 'learning' && <Learning />}
            {page === 'about' && <About />}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HelpProvider>
      <RealtimeProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </RealtimeProvider>
    </HelpProvider>
  );
}
