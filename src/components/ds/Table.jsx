'use client';
import React from 'react';
import { Table as AntTable, ConfigProvider, theme } from 'antd';

/* Data table over antd Table, keeping the DS API:
   columns: [{ key, header (or label/title), render(value, row), width, align,
              mono, primary }]
   rows, rowKey (field name), onRowClick(row), selectedKey, compact, hover.
   Pagination is off (callers render full lists). */
export function Table({ columns = [], rows = [], compact = false, hover = true, rowKey, onRowClick, selectedKey, className = '', style, ...rest }) {
  const { token } = theme.useToken();
  const { getPrefixCls } = React.useContext(ConfigProvider.ConfigContext);
  const selectedCls = `${getPrefixCls('table')}-row-selected`;

  const indexOf = React.useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => m.set(r, i));
    return m;
  }, [rows]);
  const keyOf = (row) => (rowKey ? row[rowKey] : indexOf.get(row));

  const antColumns = columns.map((c) => ({
    key: c.key,
    dataIndex: c.key,
    title: c.header ?? c.label ?? c.title,
    width: c.width,
    align: c.align,
    render: (v, row) => {
      const content = c.render ? c.render(v, row) : v;
      if (c.mono) return <span style={{ fontFamily: token.fontFamilyCode, fontSize: 12.5 }}>{content}</span>;
      if (c.primary) return <span style={{ fontWeight: 500, color: token.colorText }}>{content}</span>;
      return content;
    },
  }));

  const table = (
    <AntTable
      columns={antColumns}
      dataSource={rows}
      rowKey={keyOf}
      pagination={false}
      size={compact ? 'small' : 'medium'}
      scroll={{ x: 'max-content' }}
      rowClassName={(row) => (selectedKey != null && selectedKey === keyOf(row) ? selectedCls : '')}
      onRow={onRowClick ? (row) => ({ onClick: () => onRowClick(row), style: { cursor: 'pointer' } }) : undefined}
    />
  );

  return (
    <div className={className} style={style} {...rest}>
      {hover ? table : (
        <ConfigProvider theme={{ components: { Table: { rowHoverBg: token.colorBgContainer } } }}>{table}</ConfigProvider>
      )}
    </div>
  );
}
