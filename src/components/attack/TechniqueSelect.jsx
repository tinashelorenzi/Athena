'use client';
import React, { useMemo } from 'react';
import { Select, Tag, Tooltip, Typography } from 'antd';
import { DOMAINS, useAttackDataset } from './attackData';

/* Searchable multi-select over every Enterprise + ICS technique. Value is a
   list of technique IDs ("T1059.001", "T0855"). IDs that aren't in the loaded
   datasets (e.g. the data hasn't been synced) are kept and shown as-is. */
export function TechniqueSelect({ value, onChange, ...rest }) {
  const enterprise = useAttackDataset('enterprise');
  const ics = useAttackDataset('ics');

  const { options, names } = useMemo(() => {
    const names = new Map();
    const group = (key, data) => {
      if (!data) return null;
      const opts = data.techniques
        .map((t) => {
          const name = t.isSub ? `${data.byId.get(t.parent)?.name ?? t.parent}: ${t.name}` : t.name;
          names.set(t.id, name);
          return { value: t.id, label: `${t.id} — ${name}` };
        })
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
      return { label: DOMAINS[key].label, title: DOMAINS[key].label, options: opts };
    };
    return { options: [group('enterprise', enterprise.data), group('ics', ics.data)].filter(Boolean), names };
  }, [enterprise.data, ics.data]);

  const loading = !enterprise.data && !enterprise.error && !ics.data && !ics.error;
  const failed = enterprise.error && ics.error;

  return (
    <>
      <Select
        mode="multiple"
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        loading={loading}
        placeholder={loading ? 'Loading ATT&CK techniques…' : 'Search by ID or name, e.g. T1566 or PowerShell'}
        value={value}
        onChange={onChange}
        options={options}
        tagRender={({ value: id, closable, onClose }) => (
          <Tooltip title={names.get(id)}>
            <Tag
              color="geekblue"
              closable={closable}
              onClose={onClose}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              style={{ marginInlineEnd: 4, fontFamily: 'var(--ath-font-family-code)' }}
            >
              {id}
            </Tag>
          </Tooltip>
        )}
        style={{ width: '100%' }}
        {...rest}
      />
      {failed && (
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          ATT&amp;CK data unavailable — run &quot;npm run sync:attack&quot; to enable technique search.
        </Typography.Text>
      )}
    </>
  );
}

export default TechniqueSelect;
