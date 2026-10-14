import React from 'react';
import { api } from '../lib/api';
import { useAsync, Loading, ErrorState } from '../lib/useAsync';
import { Panel, Badge, DataTable, Progress } from '../components/ui';
import { InfoIcon } from '../components/InfoIcon';
import { fmt, STATUS_LABEL } from '../lib/format';
import type { Equipment, Material, Operator, Product, Tooling } from '../lib/types';

type Tab = 'products' | 'materials' | 'equipment' | 'toolings' | 'operators';

const TABS: { key: Tab; label: string }[] = [
  { key: 'products', label: '产品型号' },
  { key: 'materials', label: '物料SKU' },
  { key: 'equipment', label: '设备台账' },
  { key: 'toolings', label: '工装夹具' },
  { key: 'operators', label: '作业人员' },
];

const HELP_BY_LABEL: Record<string, string> = {
  '产品型号': 'product_count',
  '物料SKU': 'material_count',
  '设备类型/台套': 'equipment_count',
  '工装夹具': 'tooling_count',
  '作业人员': 'operator_count',
};

export function DataCenter() {
  const [tab, setTab] = React.useState<Tab>('products');
  const meta = useAsync(() => api.meta());
  const products = useAsync(() => api.products());
  const equipment = useAsync(() => api.equipment());
  const toolings = useAsync(() => api.toolings());
  const operators = useAsync(() => api.operators());

  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState('');
  const materials = useAsync(() => api.materials(q, category), [q, category]);

  const [seed, setSeed] = React.useState('');
  const [regen, setRegen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const doRegen = async () => {
    setBusy(true);
    try {
      const r = await api.regenerate(Number(seed) || undefined);
      setRegen(`已重新生成数据集，平均换产 ${fmt(r.overview.avgChangeoverMinutes)} 分钟，OEE ${fmt(r.overview.oee)}%`);
      meta.reload(); products.reload(); equipment.reload(); toolings.reload(); operators.reload(); materials.reload();
    } finally {
      setBusy(false);
    }
  };

  const counts = meta.data?.counts;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-5">
        {[
          { label: '产品型号', value: counts?.products, unit: '种', req: '≥10', helpKey: 'product_count' },
          { label: '物料SKU', value: counts?.materials, unit: '种', req: '≥50', helpKey: 'material_count' },
          { label: '设备类型/台套', value: counts?.equipment, unit: '台', req: '≥5类', helpKey: 'equipment_count' },
          { label: '工装夹具', value: counts?.toolings, unit: '套', req: '选配', helpKey: 'tooling_count' },
          { label: '作业人员', value: counts?.operators, unit: '人', req: '≥10', helpKey: 'operator_count' },
        ].map((c) => (
          <div className="panel kpi" key={c.label}>
            <div className="kpi-label">{c.label}<InfoIcon helpKey={c.helpKey as never} inline /></div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{c.value ?? '-'}<span className="unit">{c.unit}</span></div>
            <div className="kpi-trend">参考规模 {c.req}</div>
          </div>
        ))}
      </div>

      <Panel title="仿真数据集生成" sub="模拟数据满足生产运行规模，支持按随机种子复现" helpKey="time_span_days"
        right={
          <div className="controls">
            <input type="number" placeholder="随机种子（可选）" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 170 }} />
            <button className="btn primary" onClick={doRegen} disabled={busy}>{busy ? '生成中...' : '重新生成数据集'}</button>
          </div>
        }>
        <div className="grid cols-4">
          <div className="kv"><span>时间跨度</span><b>{meta.data?.timeSpanDays} 天</b></div>
          <div className="kv"><span>换产事件</span><b>{counts?.events} 次（要求 ≥50）</b></div>
          <div className="kv"><span>覆盖场景</span><b>{meta.data?.scenarios.length} 类</b></div>
          <div className="kv"><span>生产数据来源</span><b>真实 PCBA BOM 数据</b></div>
        </div>
        {regen && <div className="muted" style={{ marginTop: 10, color: '#10b981' }}>{regen}</div>}
      </Panel>

      <Panel title="数据资产浏览" sub="基于生产实际的 PCBA BOM 数据构建" helpKey="product_count"
        right={<div className="controls">
          {TABS.map((t) => (
            <button key={t.key} className={`btn ${tab === t.key ? 'primary' : 'ghost'}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>}>

        {tab === 'products' && (products.loading ? <Loading /> : (
          <DataTable<Product>
            keyField={(r) => r.code}
            rows={products.data!.items}
            columns={[
              { key: 'code', title: '成品专用号', render: (r) => <span className="mono">{r.code}</span> },
              { key: 'faces', title: '工艺面', render: (r) => r.faces.join(' / ') },
              { key: 'quantity', title: '排产数量' },
              { key: 'materialCount', title: '物料行数' },
              { key: 'totalComponents', title: '元件总数' },
              { key: 'complexity', title: '复杂度', render: (r) => <div style={{ width: 90 }}><Progress value={r.complexity * 60} color="#a855f7" /></div> },
              { key: 'baseChangeoverMinutes', title: '基准换产', render: (r) => `${fmt(r.baseChangeoverMinutes)}′` },
              { key: 'route', title: '工艺路线', render: (r) => <span className="muted">{r.route.join(' → ')}</span> },
            ]}
          />
        ))}

        {tab === 'materials' && (materials.loading ? <Loading /> : materials.error ? <ErrorState error={materials.error} onRetry={materials.reload} /> : (
          <>
            <div className="controls" style={{ marginBottom: 12 }}>
              <input type="text" placeholder="搜索物料编码/名称" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">全部分类</option>
                {materials.data!.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="muted">匹配 {materials.data!.total} 条（展示前 200 条）</span>
            </div>
            <DataTable<Material>
              keyField={(r) => r.sku}
              rows={materials.data!.items}
              columns={[
                { key: 'sku', title: '物料编码', render: (r) => <span className="mono">{r.sku}</span> },
                { key: 'name', title: '物料描述' },
                { key: 'category', title: '分类', render: (r) => <Badge color="#06b6d4">{r.category}</Badge> },
              { key: 'stock', title: '库存', render: (r) => <>{r.stock}<InfoIcon helpKey="material_stock" inline /></> },
              { key: 'safetyStock', title: '安全库存', render: (r) => <>{r.safetyStock}<InfoIcon helpKey="material_safety_stock" inline /></> },
                { key: 'stockState', title: '库存状态', render: (r) => r.stock < r.safetyStock ? <Badge color="#ef4444">低于安全库存</Badge> : <Badge color="#10b981">充足</Badge> },
                { key: 'location', title: '库位' },
                { key: 'leadTimeMinutes', title: '拣配时长', render: (r) => <>{r.leadTimeMinutes}′<InfoIcon helpKey="material_lead_time" inline /></> },
              ]}
            />
          </>
        ))}

        {tab === 'equipment' && (equipment.loading ? <Loading /> : (
          <DataTable<Equipment>
            keyField={(r) => r.id}
            rows={equipment.data!.items}
            columns={[
              { key: 'name', title: '设备' },
              { key: 'type', title: '类型' },
              { key: 'line', title: '产线' },
              { key: 'status', title: '状态', render: (r) => <Badge color="#10b981">{STATUS_LABEL[r.status] ?? r.status}</Badge> },
              { key: 'currentProduct', title: '当前产品', render: (r) => <span className="mono">{r.currentProduct}</span> },
              { key: 'program', title: '程序号', render: (r) => <span className="mono">{r.program} <InfoIcon helpKey="equipment_program" inline /></span> },
              { key: 'temperature', title: '温度', render: (r) => r.temperature ? `${r.temperature}℃` : '-' },
              { key: 'oee', title: 'OEE', render: (r) => <div style={{ width: 90 }}><Progress value={r.oee} color="#10b981" /></div> },
              { key: 'utilization', title: '利用率', render: (r) => <>{fmt(r.utilization)}% <InfoIcon helpKey="equipment_utilization" inline /></> },
            ]}
          />
        ))}

        {tab === 'toolings' && (toolings.loading ? <Loading /> : (
          <DataTable<Tooling>
            keyField={(r) => r.id}
            rows={toolings.data!.items}
            columns={[
              { key: 'id', title: '工装编号', render: (r) => <span className="mono">{r.id}</span> },
              { key: 'name', title: '名称' },
              { key: 'type', title: '类型' },
              { key: 'forProduct', title: '适配产品', render: (r) => <span className="mono">{r.forProduct}</span> },
              { key: 'status', title: '状态', render: (r) => <Badge color="#a855f7">{STATUS_LABEL[r.status] ?? r.status}</Badge> },
              { key: 'installMinutes', title: '拆装时长', render: (r) => `${fmt(r.installMinutes)}′` },
              { key: 'line', title: '产线' },
            ]}
          />
        ))}

        {tab === 'operators' && (operators.loading ? <Loading /> : (
          <DataTable<Operator>
            keyField={(r) => r.id}
            rows={operators.data!.items}
            columns={[
              { key: 'id', title: '工号', render: (r) => <span className="mono">{r.id}</span> },
              { key: 'name', title: '姓名' },
              { key: 'role', title: '工种', render: (r) => <Badge color="#f59e0b">{r.role}</Badge> },
              { key: 'skill', title: '技能等级', render: (r) => <>{r.skill} <InfoIcon helpKey="operator_skill" inline /></> },
              { key: 'shift', title: '班次' },
              { key: 'status', title: '状态', render: (r) => <Badge color="#10b981">{STATUS_LABEL[r.status] ?? r.status}</Badge> },
              { key: 'efficiency', title: '效率系数', render: (r) => <>{r.efficiency} <InfoIcon helpKey="operator_efficiency" inline /></> },
            ]}
          />
        ))}
      </Panel>
    </div>
  );
}
