'use client';
import React, { useState } from 'react';
import { Popover, Progress, Tooltip, Typography } from 'antd';
import { CheckCircleFilled, DownOutlined, ExperimentOutlined, RightOutlined } from '@ant-design/icons';
import styles from './AttackMatrix.module.css';

/* Navigator-style matrix: tactics as columns, techniques as cells, sub-techniques
   expand inline. Filtering is done upstream (useMatrix); this only lays out.
   `covered` (a Set, or null when off) highlights techniques with an Athena scenario. */
export function AttackMatrix({ columns, matches, query, studied, covered = null, expandAll, onOpen }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const searching = Boolean(query.trim());

  return (
    <div className={styles.scroller}>
      <div className={styles.grid}>
        {columns.map(({ tactic, all, visible }) => {
          const done = all.filter((t) => studied.has(t.id)).length;
          return (
            <div key={tactic.id} className={styles.column}>
              <Popover
                title={`${tactic.name} · ${tactic.id}`}
                content={<Typography.Paragraph style={{ maxWidth: 360, margin: 0 }}>{tactic.description.split('\n')[0]}</Typography.Paragraph>}
                placement="bottom"
              >
                <div className={styles.columnHead}>
                  <div className={styles.columnTitle}>{tactic.name}</div>
                  <div className={styles.columnMeta}>
                    {visible.length === all.length ? `${all.length} techniques` : `${visible.length} of ${all.length} techniques`}
                  </div>
                  <Tooltip title={`${done} of ${all.length} studied`}>
                    <Progress percent={all.length ? Math.round((done / all.length) * 100) : 0} size="small" showInfo={false} style={{ margin: '6px 0 0' }} />
                  </Tooltip>
                </div>
              </Popover>

              <div className={styles.cells}>
                {visible.map(({ technique: t, subs, subMatches, self }) => {
                  // While searching, open parents whose sub-techniques matched.
                  const open = expandAll || expanded.has(t.id) || (searching && subMatches.length > 0);
                  const shownSubs = searching || !self ? subMatches : subs;
                  return (
                    <React.Fragment key={t.id}>
                      <Cell
                        t={t}
                        studied={studied.has(t.id)}
                        covered={covered?.has(t.id)}
                        highlight={searching && self}
                        onOpen={onOpen}
                        subCount={subs.length}
                        open={open}
                        onToggle={() => toggle(t.id)}
                      />
                      {open && shownSubs.length > 0 && (
                        <div className={styles.subs}>
                          {shownSubs.map((s) => (
                            <Cell key={s.id} t={s} studied={studied.has(s.id)} covered={covered?.has(s.id)} highlight={searching && matches.has(s.id)} onOpen={onOpen} />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                {visible.length === 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 12, padding: '4px 10px' }}>No matches</Typography.Text>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ t, studied, covered, highlight, onOpen, subCount = 0, open, onToggle }) {
  const cls = [styles.cell, studied && styles.cellStudied, covered && styles.cellCovered, highlight && styles.cellMatch].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <button type="button" className={styles.cellMain} onClick={() => onOpen(t.id)}>
        <div className={styles.cellName}>
          {t.name}
          {studied && <CheckCircleFilled style={{ color: 'var(--ath-color-success)', fontSize: 11, marginLeft: 5 }} />}
          {covered && <ExperimentOutlined aria-label="Practice scenario available" style={{ color: 'var(--ath-color-warning)', fontSize: 11, marginLeft: 5 }} />}
        </div>
        <div className={styles.cellId}>{t.id}</div>
      </button>
      {subCount > 0 && (
        <Tooltip title={`${open ? 'Hide' : 'Show'} ${subCount} sub-techniques`}>
          <button type="button" className={styles.subToggle} onClick={onToggle} aria-expanded={open} aria-label={`Toggle sub-techniques of ${t.name}`}>
            {open ? <DownOutlined /> : <RightOutlined />}
            <span>{subCount}</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
}

export default AttackMatrix;
