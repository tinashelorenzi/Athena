'use client';
import React from 'react';
import { Button, Space, theme } from 'antd';
import { SearchOutlined, ClockCircleOutlined, CaretRightOutlined, CodeOutlined } from '@ant-design/icons';

const KEYWORDS = new Set(['and', 'or', 'not', 'AND', 'OR', 'NOT', 'by', 'where', 'sequence']);

const TOK = {
  field: { color: 'var(--syntax-field, #2326B8)' },
  op: { color: 'var(--syntax-operator, #7B869F)' },
  kw: { color: 'var(--syntax-keyword, #9A3DD1)', fontWeight: 600 },
  str: { color: 'var(--syntax-string, #17915A)' },
  num: { color: 'var(--syntax-number, #D9691A)' },
  paren: { color: 'var(--text-tertiary, #7B869F)' },
};

function highlight(q) {
  // Tokenize into field/operator/keyword/string/number/paren/plain runs.
  const parts = q.split(/("[^"]*"|\s+|[():]|[<>=!]+|\band\b|\bor\b|\bnot\b)/gi).filter((s) => s !== '' && s != null);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i];
    if (/^\s+$/.test(t)) { out.push(t); continue; }
    if (/^".*"$/.test(t)) { out.push(<span key={i} style={TOK.str}>{t}</span>); continue; }
    if (t === ':' || /^[<>=!]+$/.test(t)) { out.push(<span key={i} style={TOK.op}>{t}</span>); continue; }
    if (t === '(' || t === ')') { out.push(<span key={i} style={TOK.paren}>{t}</span>); continue; }
    if (KEYWORDS.has(t)) { out.push(<span key={i} style={TOK.kw}>{t}</span>); continue; }
    if (/^-?\d+(\.\d+)?$/.test(t)) { out.push(<span key={i} style={TOK.num}>{t}</span>); continue; }
    // field if the next non-space token is ':' or operator
    let j = i + 1; while (parts[j] && /^\s+$/.test(parts[j])) j++;
    if (parts[j] === ':' || /^[<>=!]+$/.test(parts[j] || '')) { out.push(<span key={i} style={TOK.field}>{t}</span>); continue; }
    out.push(<span key={i}>{t}</span>);
  }
  return out;
}

/* KQL search bar: language toggle · syntax-highlighted query field · time
   range · Run, laid out as an antd Space.Compact group. The field overlays a
   transparent <input> on a highlighted mirror so the caret stays native. */
export function KqlBar({
  value = '',
  onChange,
  onRun,
  language = 'KQL',
  onToggleLanguage,
  timeRange = 'Last 15 minutes',
  onTimeClick,
  placeholder = 'Search with KQL — e.g. event.action : "process_start" and user.name : "svc-batch"',
  className = '',
  style,
  ...rest
}) {
  const { token } = theme.useToken();
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const hlRef = React.useRef(null);
  const syncScroll = () => { if (hlRef.current && inputRef.current) hlRef.current.scrollLeft = inputRef.current.scrollLeft; };

  const h = token.controlHeight;
  const mono = {
    fontFamily: token.fontFamilyCode,
    fontSize: 13,
    lineHeight: `${h - 2}px`,
    whiteSpace: 'pre',
    overflow: 'hidden',
    letterSpacing: 0,
  };

  return (
    <Space.Compact block className={className} style={style}>
      <Button icon={<CodeOutlined />} onClick={onToggleLanguage} title="Toggle query language" style={{ fontFamily: token.fontFamilyCode, fontWeight: 600 }}>
        {language}
      </Button>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 11px',
          height: h,
          marginInlineStart: -1,
          background: token.colorBgContainer,
          border: `1px solid ${focused ? token.colorPrimary : token.colorBorder}`,
          boxShadow: focused ? `0 0 0 2px ${token.colorPrimaryBg}` : 'none',
          position: 'relative',
          zIndex: focused ? 2 : 1,
          transition: `border-color ${token.motionDurationMid}`,
        }}
      >
        <SearchOutlined style={{ color: token.colorTextTertiary }} aria-hidden="true" />
        <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
          <div ref={hlRef} aria-hidden="true" style={{ ...mono, position: 'absolute', inset: 0, pointerEvents: 'none', color: token.colorText, display: 'flex', alignItems: 'center' }}>
            {value ? highlight(value) : ''}
          </div>
          <input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            aria-label="Query"
            onScroll={syncScroll}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange && onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onRun) onRun(value); }}
            style={{
              ...mono,
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              position: 'relative',
              zIndex: 1,
              color: value ? 'transparent' : token.colorTextTertiary,
              caretColor: token.colorPrimary,
            }}
            {...rest}
          />
        </div>
      </div>
      <Button icon={<ClockCircleOutlined />} onClick={onTimeClick}>{timeRange}</Button>
      <Button type="primary" icon={<CaretRightOutlined />} onClick={() => onRun && onRun(value)}>Run</Button>
    </Space.Compact>
  );
}
