'use client';
import React, { useState } from 'react';
import { Modal, Descriptions, Radio, Input, Select, Button, Switch, Flex, Typography, Tag, Divider, Empty, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, AlertOutlined } from '@ant-design/icons';
import { saveAlertCase } from '@/app/actions/cases';
import { athenaTheme } from '@/theme/antdTheme';

const { Text } = Typography;

export const VERDICTS = [
  { id: 'TRUE_POSITIVE', label: 'True Positive', short: 'TP', color: 'red' },
  { id: 'FALSE_POSITIVE', label: 'False Positive', short: 'FP', color: 'default' },
  { id: 'BENIGN', label: 'Benign', short: 'Benign', color: 'green' },
  { id: 'ESCALATED', label: 'Escalated', short: 'Esc', color: 'orange' },
];
const IOC_TYPES = ['ip', 'domain', 'url', 'hash', 'email', 'other'];
const mono = { fontFamily: athenaTheme.token.fontFamilyCode };

/* Per-alert case editor: alert detail, verdict, notes, IoCs, open/closed. Saves
   to the DB and reports the new state back so the alert queue updates without a
   reload. */
export function AlertCaseDialog({ alert, caseData, scenarioId, onClose, onSaved, onError, preview }) {
  const [verdict, setVerdict] = useState(caseData?.verdict ?? null);
  const [status, setStatus] = useState(caseData?.status ?? 'OPEN');
  const [notes, setNotes] = useState(caseData?.notes ?? '');
  const [iocs, setIocs] = useState(() => (caseData?.iocs?.length ? caseData.iocs.map((i) => ({ type: i.type || 'other', value: i.value || '' })) : []));
  const [busy, setBusy] = useState(false);
  if (!alert) return null;

  const addIoc = () => setIocs((l) => [...l, { type: 'ip', value: '' }]);
  const setIoc = (i, patch) => setIocs((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const delIoc = (i) => setIocs((l) => l.filter((_, j) => j !== i));

  const save = async () => {
    const payload = { verdict, status, notes, iocs: iocs.filter((i) => i.value.trim()) };
    if (preview) { onSaved?.(alert.id, { ...payload }); onClose(); return; }
    setBusy(true);
    const res = await saveAlertCase(scenarioId, alert.id, payload);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    onSaved?.(alert.id, { ...payload });
    onClose();
  };

  const extra = alert.fields && typeof alert.fields === 'object' ? Object.entries(alert.fields) : [];
  const detail = [
    { key: 'id', label: 'Alert ID', children: <Text style={mono} copyable>{alert.id}</Text> },
    { key: 'seek', label: 'Fired', children: <Text style={mono}>T+{alert.seek ?? alert.at ?? 0}s</Text> },
    { key: 'host', label: 'Host', children: alert.host ? <Text style={mono} copyable>{alert.host}</Text> : '—' },
    { key: 'rule', label: 'Rule', children: alert.rule ? <Tag color="geekblue" style={mono}>{alert.rule}</Tag> : '—' },
    { key: 'src', label: 'Source', children: alert.source ? <Text style={mono} copyable>{alert.source}</Text> : '—' },
    { key: 'dst', label: 'Destination', children: alert.destination ? <Text style={mono} copyable>{alert.destination}</Text> : '—' },
    { key: 'count', label: 'Events', children: <Text style={mono}>{alert.count ?? '—'}</Text> },
    ...extra.map(([k, v]) => ({
      key: `f:${k}`, label: k,
      children: <Text style={{ ...mono, wordBreak: 'break-all' }}>{v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>,
    })),
  ];

  return (
    <Modal
      open
      width={760}
      destroyOnHidden
      onCancel={onClose}
      title={<Space><AlertOutlined /><span>Case · {alert.title || alert.id}</span></Space>}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="save" type="primary" loading={busy} icon={<CheckOutlined />} onClick={save}>Save case</Button>,
      ]}
    >
      <Flex vertical gap={18}>
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} items={detail} />

        <div>
          <Text strong>1. Verdict</Text>
          <div style={{ marginTop: 8 }}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={verdict}
              options={VERDICTS.map((v) => ({ value: v.id, label: v.label }))}
              onChange={(e) => setVerdict(e.target.value)}
            />
            {verdict && <Button type="link" size="small" onClick={() => setVerdict(null)}>Clear</Button>}
          </div>
        </div>

        <div>
          <Text strong>2. Analyst notes</Text>
          <Input.TextArea
            style={{ marginTop: 8 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoSize={{ minRows: 4, maxRows: 12 }}
            placeholder="What did you find? Reasoning for the verdict…"
            spellCheck={false}
          />
        </div>

        <div>
          <Flex align="center" justify="space-between">
            <Text strong>3. Indicators of compromise</Text>
            <Button size="small" icon={<PlusOutlined />} onClick={addIoc}>Add IoC</Button>
          </Flex>
          <Flex vertical gap={8} style={{ marginTop: 8 }}>
            {iocs.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No IoCs recorded" style={{ margin: 0 }} />}
            {iocs.map((ioc, i) => (
              <Space.Compact key={i} block>
                <Select style={{ width: 120 }} value={ioc.type} onChange={(v) => setIoc(i, { type: v })} options={IOC_TYPES.map((t) => ({ value: t, label: t.toUpperCase() }))} />
                <Input value={ioc.value} onChange={(e) => setIoc(i, { value: e.target.value })} placeholder="e.g. 185.220.101.34" style={mono} />
                <Tooltip title="Remove"><Button icon={<DeleteOutlined />} onClick={() => delIoc(i)} /></Tooltip>
              </Space.Compact>
            ))}
          </Flex>
        </div>

        <Divider style={{ margin: 0 }} />
        <Flex align="center" justify="space-between" gap={12}>
          <div>
            <Text strong>Close this case</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Mark it handled once you&apos;ve reached a verdict.</Text></div>
          </div>
          <Switch checked={status === 'CLOSED'} checkedChildren="Closed" unCheckedChildren="Open" onChange={(on) => setStatus(on ? 'CLOSED' : 'OPEN')} />
        </Flex>
      </Flex>
    </Modal>
  );
}

export default AlertCaseDialog;
