'use client';
import React, { useMemo, useState } from 'react';
import { Card, Flex, Input, Button, Tag, Tooltip, Table, Descriptions, Empty, Spin, Typography, theme } from 'antd';
import { SearchOutlined, UnorderedListOutlined, ClockCircleOutlined, NumberOutlined, FileSearchOutlined } from '@ant-design/icons';
import { filterLogs, availableFields } from '@/lib/kql';

/* Kibana-Discover-style log search: KQL query bar, a time histogram you can brush
   to select a window (the time controller), a field list, and expandable
   documents — as close to real ELK/Discover as a simulation gets. */
function ecsDoc(e) {
  const base = {
    '@timestamp': e.ts,
    'host.name': e.host,
    'event.dataset': e.source,
    'event.action': e.action,
    'user.name': e.user,
    message: e.message,
  };
  if (e.fields) for (const k of Object.keys(e.fields)) base[k] = e.fields[k];
  return base;
}
const { Text, Title } = Typography;
const hhmmss = (ms) => (Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(11, 19));
const tsMs = (e) => Date.parse(String(e.ts));
// Stable identity for a log doc so expanded rows + keys survive live streaming
// (new events change array indices; content does not).
const docId = (e) => `${e.ts}|${e.host}|${e.source}|${e.action}|${e.message}`;

export function LogsPanel({ run }) {
  const { token } = theme.useToken();
  const entries = useMemo(() => (Array.isArray(run.logs) ? run.logs : []), [run.logs]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [showFields, setShowFields] = useState(true);
  const [sel, setSel] = useState(null);          // { start, end } ms — brushed time window
  const [drag, setDrag] = useState(null);        // { a, b } bucket indices while dragging

  const { docs: kqlDocs, error } = useMemo(() => filterLogs(query, entries), [query, entries]);
  const fields = useMemo(() => availableFields(entries), [entries]);

  // Time span + buckets over all fired entries (stable axis).
  const { fullMin, fullMax, bucketMs, counts, maxCount } = useMemo(() => {
    const times = entries.map(tsMs).filter((n) => !Number.isNaN(n));
    const min = times.length ? Math.min(...times) : 0;
    const max = times.length ? Math.max(...times) : 0;
    const spanS = Math.max(1, Math.round((max - min) / 1000));
    const n = Math.min(60, Math.max(1, spanS));
    const size = Math.max(1, (max - min) / n) || 1;
    const c = new Array(n).fill(0);
    for (const e of kqlDocs) {
      const t = tsMs(e);
      if (Number.isNaN(t)) continue;
      const idx = Math.min(n - 1, Math.max(0, Math.floor((t - min) / size)));
      c[idx] += 1;
    }
    return { fullMin: min, fullMax: max, buckets: n, bucketMs: size, counts: c, maxCount: Math.max(1, ...c) };
  }, [entries, kqlDocs]);

  // Apply the brushed time window to the query results, then show newest-first
  // (Discover-style) so streaming events land at the top of the list.
  const docs = useMemo(() => {
    const windowed = sel ? kqlDocs.filter((e) => { const t = tsMs(e); return t >= sel.start && t < sel.end; }) : kqlDocs;
    return [...windowed].reverse();
  }, [kqlDocs, sel]);

  const toggle = (id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const addField = (f) => setQuery((q) => (q.trim() ? `${q.trim()} and ${f}:` : `${f}:`));

  const onUp = () => {
    if (!drag) return;
    const lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
    setSel({ start: fullMin + lo * bucketMs, end: fullMin + (hi + 1) * bucketMs });
    setDrag(null);
  };
  const inActive = (i) => {
    if (drag) return i >= Math.min(drag.a, drag.b) && i <= Math.max(drag.a, drag.b);
    if (sel) { const s = fullMin + i * bucketMs; return s >= sel.start && s < sel.end; }
    return true;
  };

  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12 };
  const header = (
    <PanelHeader
      icon={<FileSearchOutlined />}
      title="Logs · Discover"
      sub={`Search with KQL · brush the histogram to filter by time${run.status === 'PAUSED' ? ' · paused' : ''}`}
    />
  );

  if (run.status === 'NONE') {
    return <div>{header}<NotRunningCard label="log" /></div>;
  }

  const columns = [
    { title: 'Time', dataIndex: 'ts', key: 'ts', width: 200, render: (v) => <Text type="secondary" style={mono}>{v}</Text> },
    { title: 'host.name', dataIndex: 'host', key: 'host', width: 140, ellipsis: true, render: (v) => <Text style={{ ...mono, color: token.colorPrimary }}>{v || '—'}</Text> },
    { title: 'event.action', dataIndex: 'action', key: 'action', width: 160, ellipsis: true, render: (v) => <Text style={mono}>{v || '—'}</Text> },
    { title: 'message', dataIndex: 'message', key: 'message', ellipsis: true, render: (v) => <Text style={mono}>{v}</Text> },
  ];

  return (
    <div>
      {header}

      {/* KQL query bar */}
      <Flex gap={8} style={{ marginBottom: 12 }}>
        <Input
          size="large"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="event.action:process_start and host.name:win-ep-04"
          spellCheck={false}
          allowClear
          status={error ? 'error' : undefined}
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          suffix={<Tag style={{ marginInlineEnd: 0 }}>KQL</Tag>}
          style={{ fontFamily: token.fontFamilyCode, fontSize: 13 }}
        />
        <Tooltip title={showFields ? 'Hide fields' : 'Show fields'}>
          <Button size="large" icon={<UnorderedListOutlined />} type={showFields ? 'default' : 'dashed'} onClick={() => setShowFields((v) => !v)} />
        </Tooltip>
      </Flex>

      {/* Histogram (graph timeline) + time controller */}
      <Card size="small">
        <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
          {error
            ? <Text type="danger" style={{ fontSize: 12 }}>{error}</Text>
            : <Text type="secondary" style={{ fontSize: 12 }}><Text strong>{docs.length}</Text> hits</Text>}
          {sel ? (
            <Tag closable onClose={() => setSel(null)} icon={<ClockCircleOutlined />} color="processing" style={mono}>
              {hhmmss(sel.start)} → {hhmmss(sel.end)}
            </Tag>
          ) : (
            <Text type="secondary" style={mono}>{hhmmss(fullMin)} → {hhmmss(fullMax)}</Text>
          )}
        </Flex>
        <div
          onMouseUp={onUp}
          onMouseLeave={() => setDrag(null)}
          style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64, cursor: 'crosshair', userSelect: 'none' }}
        >
          {counts.map((c, i) => (
            <div
              key={i}
              onMouseDown={() => setDrag({ a: i, b: i })}
              onMouseEnter={() => setDrag((d) => (d ? { ...d, b: i } : d))}
              title={`${hhmmss(fullMin + i * bucketMs)} · ${c} event${c === 1 ? '' : 's'}`}
              style={{ flex: 1, minWidth: 2, height: `${Math.max(c ? 6 : 0, (c / maxCount) * 100)}%`, background: inActive(i) ? token.colorPrimary : token.colorBorder, opacity: inActive(i) ? 0.85 : 0.6, borderRadius: '2px 2px 0 0' }}
            />
          ))}
        </div>
        <Flex justify="space-between" style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ ...mono, fontSize: 11 }}>{hhmmss(fullMin)}</Text>
          <Text type="secondary" style={{ ...mono, fontSize: 11 }}>{hhmmss(fullMin + (fullMax - fullMin) / 2)}</Text>
          <Text type="secondary" style={{ ...mono, fontSize: 11 }}>{hhmmss(fullMax)}</Text>
        </Flex>
      </Card>

      <Flex gap={12} align="flex-start" style={{ marginTop: 12 }}>
        {showFields && (
          <Card size="small" title="Fields" style={{ width: 200, flex: 'none' }} styles={{ body: { padding: 4, maxHeight: 480, overflow: 'auto' } }}>
            {fields.map((f) => (
              <Tooltip key={f} title={`Filter on ${f}`} placement="right">
                <Button type="text" size="small" block icon={<NumberOutlined style={{ color: token.colorTextTertiary }} />} onClick={() => addField(f)}
                  style={{ justifyContent: 'flex-start', ...mono, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f}
                </Button>
              </Tooltip>
            ))}
          </Card>
        )}

        <Card size="small" style={{ flex: 1, minWidth: 0 }} styles={{ body: { padding: 0 } }}>
          {entries.length === 0 ? (
            <Flex align="center" gap={8} style={{ padding: 16 }}><Spin size="small" /><Text type="secondary">Monitoring… log events will stream in as they fire.</Text></Flex>
          ) : (
            <Table
              size="small"
              rowKey={docId}
              columns={columns}
              dataSource={docs}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No events match${sel ? ' in this time window' : ''}.`} /> }}
              pagination={{ defaultPageSize: 50, showSizeChanger: true, size: 'small', hideOnSinglePage: true }}
              expandable={{
                expandedRowKeys: [...expanded],
                onExpand: (_open, rec) => toggle(docId(rec)),
                expandRowByClick: true,
                expandedRowRender: (e) => (
                  <Descriptions
                    size="small"
                    bordered
                    column={1}
                    styles={{ label: { ...mono, width: 200 }, content: { ...mono, wordBreak: 'break-all' } }}
                    items={Object.entries(ecsDoc(e)).map(([k, v]) => ({ key: k, label: k, children: v === null || v === undefined ? '—' : String(v) }))}
                  />
                ),
              }}
            />
          )}
        </Card>
      </Flex>
    </div>
  );
}

/* Shared panel header (icon + title + subtitle + optional right-side extra). */
export function PanelHeader({ icon, title, sub, extra }) {
  const { token } = theme.useToken();
  return (
    <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
      <Flex align="center" justify="center" style={{ width: 36, height: 36, borderRadius: token.borderRadius, background: token.colorPrimaryBg, color: token.colorPrimary, fontSize: 17, flex: 'none' }}>{icon}</Flex>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Title level={4} style={{ margin: 0 }}>{title}</Title>
        {sub && <Text type="secondary" style={{ fontSize: 13 }}>{sub}</Text>}
      </div>
      {extra}
    </Flex>
  );
}

/* Shown in feed panels before the run has been started. */
export function NotRunningCard({ label }) {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span>Press <Text strong>Run scenario</Text> in the bar above to begin the {label} feed.</span>}
      />
    </Card>
  );
}

export default LogsPanel;
