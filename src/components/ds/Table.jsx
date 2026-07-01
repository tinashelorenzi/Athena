'use client';
import React from 'react';

const CSS = `
.ath-table-wrap{width:100%;overflow:auto;border:1px solid var(--border-default);border-radius:var(--radius-md);background:var(--surface-card);}
.ath-table{width:100%;border-collapse:collapse;font-size:var(--fs-body-sm);}
.ath-table thead th{
  position:sticky;top:0;z-index:1;text-align:left;
  background:var(--surface-panel);color:var(--text-tertiary);
  font-weight:var(--fw-semibold);font-size:var(--fs-caption);
  letter-spacing:var(--ls-wide);text-transform:uppercase;
  padding:10px 14px;border-bottom:1px solid var(--border-default);white-space:nowrap;
}
.ath-table tbody td{
  padding:0 14px;height:var(--row-h);color:var(--text-secondary);
  border-bottom:1px solid var(--border-subtle);vertical-align:middle;
}
.ath-table--compact tbody td{height:var(--row-h-compact);}
.ath-table tbody tr:last-child td{border-bottom:none;}
.ath-table--hover tbody tr{transition:background var(--dur-fast) var(--ease-standard);cursor:pointer;}
.ath-table--hover tbody tr:hover td{background:var(--surface-hover);}
.ath-table tbody tr[data-selected="true"] td{background:var(--surface-selected);}
.ath-table__mono{font-family:var(--font-mono);font-size:var(--fs-mono-sm);color:var(--text-primary);}
.ath-table__num{text-align:right;font-family:var(--font-mono);}
.ath-table th.ath-table__num{text-align:right;}
.ath-table__primary{color:var(--text-primary);font-weight:var(--fw-medium);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'table');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Table({ columns = [], rows = [], compact = false, hover = true, rowKey, onRowClick, selectedKey, className = '', ...rest }) {
  inject();
  const cls = ['ath-table', compact ? 'ath-table--compact' : '', hover ? 'ath-table--hover' : ''].filter(Boolean).join(' ');
  return (
    <div className={`ath-table-wrap ${className}`} {...rest}>
      <table className={cls}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'ath-table__num' : ''} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = rowKey ? row[rowKey] : i;
            return (
              <tr key={key} data-selected={selectedKey != null && selectedKey === key} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => {
                  const cellCls = [
                    c.mono ? 'ath-table__mono' : '',
                    c.align === 'right' ? 'ath-table__num' : '',
                    c.primary ? 'ath-table__primary' : '',
                  ].filter(Boolean).join(' ');
                  return <td key={c.key} className={cellCls}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
