'use client';
import React, { useState } from 'react';
import alasql from 'alasql';
import { Card, Flex, Button, Segmented, Tag, Input, Table, Alert, Empty, Space, Typography, theme } from 'antd';
import { CodeOutlined, BulbOutlined, DesktopOutlined, CaretRightOutlined } from '@ant-design/icons';
import { PanelHeader } from './LogsPanel';

const { Text } = Typography;

/* OSQuery SQL console. osquery is SQLite under the hood, so students write real
   SQL against the endpoint's tables. No query is written for them — a lightbulb
   reveals the schema (tables + columns) as a reference; the rest is on them. */
export function OSQueryPanel({ endpoints }) {
  const { token } = theme.useToken();
  const hosts = (endpoints || []).filter((e) => e.osquery?.tables && Object.keys(e.osquery.tables).length);
  const [hostId, setHostId] = useState(hosts[0]?.id ?? null);
  const ep = hosts.find((e) => e.id === hostId) || hosts[0];
  const tables = ep?.osquery?.tables || {};
  const [sql, setSql] = useState('');
  const [result, setResult] = useState(null);   // { cols, rows } | { error }
  const [showSchema, setShowSchema] = useState(false);

  // Cheap to derive; the React Compiler memoizes it.
  const schema = Object.entries(tables).map(([name, rows]) => {
    const list = Array.isArray(rows) ? rows : [];
    const cols = [...new Set(list.flatMap((r) => Object.keys(r || {})))];
    const types = Object.fromEntries(cols.map((c) => {
      const v = list.find((r) => r && r[c] != null)?.[c];
      return [c, typeof v === 'number' ? 'INTEGER' : 'TEXT'];
    }));
    return { name, count: list.length, cols, types };
  });

  const runQuery = () => {
    const q = sql.trim();
    if (!q) { setResult({ error: 'Write a query first.' }); return; }
    try {
      const db = new alasql.Database();
      for (const [name, rows] of Object.entries(tables)) {
        db.exec(`CREATE TABLE \`${name}\``);
        db.tables[name].data = Array.isArray(rows) ? rows : [];
      }
      const rows = db.exec(q);
      const list = Array.isArray(rows) ? rows : [];
      const cols = list.length ? [...new Set(list.flatMap((r) => Object.keys(r || {})))] : [];
      setResult({ cols, rows: list });
    } catch (e) {
      setResult({ error: e?.message || 'Query error' });
    }
  };

  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12 };
  const header = (
    <PanelHeader
      icon={<CodeOutlined />}
      title="OSQuery"
      sub="Query the endpoint with SQL, just like osquery."
      extra={hosts.length > 0 && (
        <Button icon={<BulbOutlined />} type={showSchema ? 'primary' : 'default'} ghost={showSchema} onClick={() => setShowSchema((v) => !v)}>Schema</Button>
      )}
    />
  );

  if (hosts.length === 0) {
    return <div>{header}<Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No OSQuery data in this scenario." /></Card></div>;
  }

  const columns = result && !result.error
    ? result.cols.map((c) => ({
        title: c, dataIndex: c, key: c,
        render: (v) => <Text style={{ ...mono, whiteSpace: 'nowrap' }}>{v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>,
      }))
    : [];

  return (
    <Flex vertical gap={12}>
      {header}

      <Segmented
        value={ep.id}
        onChange={(v) => { setHostId(v); setResult(null); }}
        options={hosts.map((e) => ({ value: e.id, label: <span style={mono}>{e.hostname}</span>, icon: <DesktopOutlined /> }))}
        style={{ alignSelf: 'flex-start' }}
      />

      {showSchema && (
        <Card size="small" title={<Space><BulbOutlined style={{ color: token.colorWarning }} />Schema · <span style={mono}>{ep.hostname}</span></Space>}>
          <Flex vertical gap={12}>
            {schema.map((t) => (
              <div key={t.name}>
                <div style={{ marginBottom: 6 }}>
                  <Text strong style={mono}>{t.name}</Text> <Text type="secondary" style={{ fontSize: 12 }}>· {t.count} row{t.count === 1 ? '' : 's'}</Text>
                </div>
                <Flex wrap gap={6}>
                  {t.cols.map((c) => (
                    <Tag key={c} style={{ ...mono, marginInlineEnd: 0 }}>{c} <Text type="secondary" style={{ fontSize: 11 }}>{t.types[c]}</Text></Tag>
                  ))}
                </Flex>
              </div>
            ))}
          </Flex>
        </Card>
      )}

      <Input.TextArea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); } }}
        autoSize={{ minRows: 3, maxRows: 10 }}
        spellCheck={false}
        placeholder="SELECT name, path, pid FROM processes WHERE on_disk = 1"
        style={{ fontFamily: token.fontFamilyCode, fontSize: 13 }}
      />
      <Flex align="center" gap={10}>
        <Button type="primary" icon={<CaretRightOutlined />} onClick={runQuery}>Run query</Button>
        <Text type="secondary" style={{ fontSize: 12 }}><Text keyboard>Ctrl</Text>+<Text keyboard>Enter</Text></Text>
        {result && !result.error && <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</Text>}
      </Flex>

      {!result ? (
        <Card size="small"><Text type="secondary">Write a query and run it. Click <Text strong>Schema</Text> if you need the table + column names.</Text></Card>
      ) : result.error ? (
        <Alert type="error" showIcon title="Query error" description={<span style={mono}>{result.error}</span>} />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            size="small"
            rowKey={(_r, i) => i}
            columns={columns}
            dataSource={result.rows}
            scroll={{ x: 'max-content', y: 460 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No rows." /> }}
            pagination={{ defaultPageSize: 100, hideOnSinglePage: true, size: 'small' }}
          />
        </Card>
      )}
    </Flex>
  );
}

export default OSQueryPanel;
