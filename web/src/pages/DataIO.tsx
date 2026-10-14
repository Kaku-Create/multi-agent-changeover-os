import React from 'react';
import { api, ApiError } from '../lib/api';
import { useAsync, Loading } from '../lib/useAsync';
import { Panel, DataTable, Badge } from '../components/ui';
import { InfoIcon } from '../components/InfoIcon';
import { fmt } from '../lib/format';
import type { AuditEntry, ImportBatch, ImportResponse, WorkorderRow } from '../lib/types';

const KINDS = [
  { key: 'products', label: '产品与 BOM', hint: '成品专用号 / 物料编码 / 用量 等列' },
  { key: 'materials', label: '物料主数据', hint: '物料编码 / 描述 / 库存 / 安全库存' },
  { key: 'equipment', label: '设备台账', hint: '设备编号 / 类型 / 产线 / OEE' },
  { key: 'operators', label: '作业人员', hint: '工号 / 姓名 / 工种 / 班次' },
  { key: 'workorders', label: '换产工单', hint: '源产品 / 目标产品 / 场景 / 产线' },
];

export function DataIO() {
  const meta = useAsync(() => api.meta());
  const imports = useAsync(() => api.imports());
  const audit = useAsync(() => api.audit());
  const workorders = useAsync(() => api.workorders(100));

  const [kind, setKind] = React.useState('products');
  const [mode, setMode] = React.useState<'merge' | 'replace' | 'append'>('merge');
  const [content, setContent] = React.useState('');
  const [filename, setFilename] = React.useState<string | undefined>();
  const [result, setResult] = React.useState<ImportResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [seed, setSeed] = React.useState('');
  const [regenMsg, setRegenMsg] = React.useState<string | null>(null);
  const [regenBusy, setRegenBusy] = React.useState(false);

  const effectiveMode = kind === 'workorders' ? 'append' : mode;
  const isJson = content.trimStart().startsWith('[') || content.trimStart().startsWith('{');

  const refresh = () => {
    imports.reload();
    audit.reload();
    meta.reload();
    workorders.reload();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.importData(kind, {
        content,
        format: isJson ? 'json' : 'csv',
        mode: effectiveMode,
        filename,
      });
      setResult(res);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${e.details ? `（${JSON.stringify(e.details)}）` : ''}` : String(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    const text = await api.importTemplate(kind);
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file, 'utf-8');
  };

  const doRegen = async () => {
    setRegenBusy(true);
    setRegenMsg(null);
    try {
      const r = await api.regenerate(Number(seed) || undefined);
      setRegenMsg(`已重新生成数据集，平均换产 ${fmt(r.overview.avgChangeoverMinutes)} 分钟，OEE ${fmt(r.overview.oee)}%`);
      refresh();
    } catch (e) {
      setRegenMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenBusy(false);
    }
  };

  const counts = meta.data?.counts ?? {};
  const activeKind = KINDS.find((k) => k.key === kind)!;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-4">
        {[
          { label: '产品型号', value: counts.products, unit: '种' },
          { label: '物料 SKU', value: counts.materials, unit: '种' },
          { label: '设备', value: counts.equipment, unit: '台' },
          { label: '换产事件', value: counts.events, unit: '次' },
        ].map((c) => (
          <div className="panel kpi" key={c.label}>
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{c.value ?? '-'}<span className="unit">{c.unit}</span></div>
          </div>
        ))}
      </div>

      <Panel title="真实数据导入" sub="支持 CSV / JSON，自动校验并写入持久化数据库；换产工单导入将自动生成换产事件" helpKey="import_template"
        right={<button className="btn ghost" onClick={downloadTemplate}>下载 {activeKind.label} 模板</button>}>
        <div className="controls" style={{ marginBottom: 12 }}>
          <label className="field">数据类型<InfoIcon helpKey="import_template" inline />
            <select value={kind} onChange={(e) => { setKind(e.target.value); setResult(null); setError(null); }}>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          {kind !== 'workorders' && (
            <label className="field">导入模式<InfoIcon helpKey="import_mode" inline />
              <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
                <option value="merge">合并 / 覆盖同主键</option>
                <option value="replace">清空后全量替换</option>
              </select>
            </label>
          )}
          <label className="field">上传文件
            <input type="file" accept=".csv,.json,.txt" onChange={onFile} />
          </label>
          <span className="muted" style={{ alignSelf: 'flex-end' }}>{activeKind.hint}</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="粘贴 CSV 或 JSON 内容，或选择文件上传"
          rows={7}
          style={{
            width: '100%', background: 'var(--panel-solid)', color: 'var(--text)',
            border: '1px solid var(--border-strong)', borderRadius: 10, padding: 12,
            fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 12.5, resize: 'vertical',
          }}
        />
        <div className="controls" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={submit} disabled={busy || !content.trim()}>
            {busy ? '导入中...' : '开始导入'}
          </button>
          <span className="muted">识别为 {isJson ? 'JSON' : 'CSV'} · 模式 {effectiveMode}</span>
        </div>

        {error && <div className="msg" style={{ marginTop: 12, borderColor: '#ef444455' }}><span className="msg-body" style={{ color: '#ef4444' }}>{error}</span></div>}
        {result && (
          <div className="msg" style={{ marginTop: 12, borderColor: '#10b98155' }}>
            <span className="msg-body">
              导入完成：成功 <b style={{ color: '#10b981' }}>{result.imported}</b> 条，失败 <b style={{ color: result.failed ? '#ef4444' : '#6b7c9e' }}>{result.failed}</b> 条，批次 {result.batchId.slice(0, 8)}
              {result.errors.length > 0 && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {result.errors.slice(0, 5).map((er) => `第 ${er.row} 行：${er.message}`).join('；')}
                </div>
              )}
            </span>
          </div>
        )}
      </Panel>

      <Panel title="数据集生成（仿真）" sub="保留内置仿真能力，可按随机种子复现" helpKey="time_span_days"
        right={
          <div className="controls">
            <input type="number" placeholder="随机种子（可选）" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 170 }} />
            <button className="btn primary" onClick={doRegen} disabled={regenBusy}>{regenBusy ? '生成中...' : '重新生成数据集'}</button>
          </div>
        }>
        <div className="grid cols-4">
          <div className="kv"><span>时间跨度</span><b>{meta.data?.timeSpanDays ?? '-'} 天</b></div>
          <div className="kv"><span>数据集版本</span><b>v{meta.data?.datasetVersion ?? '-'}</b></div>
          <div className="kv"><span>随机种子</span><b>{meta.data?.seed ?? '-'}</b></div>
          <div className="kv"><span>生成时间</span><b>{meta.data?.generatedAt ? new Date(meta.data.generatedAt).toLocaleString('zh-CN') : '-'}</b></div>
        </div>
        {regenMsg && <div className="muted" style={{ marginTop: 10, color: '#10b981' }}>{regenMsg}</div>}
      </Panel>

      <div className="grid cols-2">
        <Panel title="导入批次记录" sub="最近 50 次导入操作" helpKey="import_batch">
          {imports.loading ? <Loading /> : (
            <DataTable<ImportBatch>
              keyField={(r) => r.id}
              rows={imports.data?.items ?? []}
              columns={[
                { key: 'created_at', title: '时间', render: (r) => new Date(r.created_at).toLocaleString('zh-CN') },
                { key: 'kind', title: '类型', render: (r) => <Badge color="#06b6d4">{r.kind}</Badge> },
                { key: 'filename', title: '文件', render: (r) => r.filename ?? '-' },
                { key: 'mode', title: '模式' },
                { key: 'imported', title: '成功', render: (r) => <span style={{ color: '#10b981' }}>{r.imported}</span> },
                { key: 'failed', title: '失败', render: (r) => <span style={{ color: r.failed ? '#ef4444' : '#6b7c9e' }}>{r.failed}</span> },
              ]}
            />
          )}
        </Panel>
        <Panel title="审计日志" sub="所有写操作留痕（最近 100 条）" helpKey="audit_log">
          {audit.loading ? <Loading /> : (
            <DataTable<AuditEntry>
              keyField={(r) => String(r.id)}
              rows={audit.data?.items ?? []}
              columns={[
                { key: 'ts', title: '时间', render: (r) => new Date(r.ts).toLocaleTimeString('zh-CN') },
                { key: 'method', title: '方法', render: (r) => <span className="mono">{r.method}</span> },
                { key: 'path', title: '路径', render: (r) => <span className="mono">{r.path}</span> },
                { key: 'status', title: '状态', render: (r) => <Badge color={r.status < 400 ? '#10b981' : '#ef4444'}>{r.status}</Badge> },
                { key: 'duration_ms', title: '耗时', render: (r) => `${fmt(r.duration_ms, 1)}ms` },
                { key: 'request_id', title: '请求ID', render: (r) => <span className="mono">{(r.request_id ?? '').slice(0, 8)}</span> },
              ]}
            />
          )}
        </Panel>
      </div>

      <Panel title="换产工单列表" sub="通过 DataIO 导入或运行时生成的工单" helpKey="workorders">
        {workorders.loading ? <Loading /> : (
          <DataTable<WorkorderRow>
            keyField={(r) => String(r.id)}
            rows={workorders.data?.items ?? []}
            columns={[
              { key: 'created_at', title: '导入时间', render: (r) => new Date(r.created_at).toLocaleString('zh-CN') },
              { key: 'batch_id', title: '批次', render: (r) => <span className="mono">{r.batch_id.slice(0, 8)}</span> },
              { key: 'from_product', title: '源产品' },
              { key: 'to_product', title: '目标产品' },
              { key: 'scenario', title: '场景', render: (r) => <Badge color="#06b6d4">{r.scenario}</Badge> },
              { key: 'line', title: '产线' },
              { key: 'day', title: '天' },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
