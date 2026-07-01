'use client';
import React from 'react';

const CSS = `
.ath-kql{
  display:flex;align-items:stretch;gap:0;width:100%;
  background:var(--surface-inset);border:1px solid var(--border-default);
  border-radius:var(--radius-sm);overflow:hidden;
  transition:border-color var(--dur-fast) var(--ease-standard),box-shadow var(--dur-fast) var(--ease-standard);
}
.ath-kql:focus-within{border-color:var(--border-focus);box-shadow:0 0 0 3px rgba(84,87,232,.22);}
.ath-kql__lang{
  display:flex;align-items:center;gap:5px;padding:0 11px;flex:none;cursor:pointer;
  background:var(--surface-raised);border:none;border-right:1px solid var(--border-default);
  color:var(--text-secondary);font-family:var(--font-mono);font-size:var(--fs-mono-sm);font-weight:var(--fw-semibold);
}
.ath-kql__lang:hover{background:var(--surface-selected);color:var(--text-primary);}
.ath-kql__lang svg{width:13px;height:13px;color:var(--accent);}
.ath-kql__field{position:relative;flex:1;min-width:0;display:flex;align-items:center;padding:0 12px;}
.ath-kql__icon{flex:none;display:flex;color:var(--text-tertiary);margin-right:9px;}
.ath-kql__icon svg{width:16px;height:16px;}
.ath-kql__editwrap{position:relative;flex:1;min-width:0;height:100%;display:flex;align-items:center;}
.ath-kql__hl,.ath-kql__input{
  font-family:var(--font-mono);font-size:var(--fs-mono);line-height:var(--control-h-md);
  white-space:pre;overflow:hidden;letter-spacing:0;
}
.ath-kql__hl{position:absolute;inset:0;pointer-events:none;color:var(--text-primary);display:flex;align-items:center;}
.ath-kql__input{width:100%;background:transparent;border:none;outline:none;color:transparent;caret-color:var(--accent);position:relative;z-index:1;padding:0;}
.ath-kql__input::placeholder{color:var(--text-tertiary);}
.ath-kql__input.ath-kql--empty{color:var(--text-tertiary);}
.ath-kql__time{display:flex;align-items:center;gap:7px;padding:0 12px;flex:none;cursor:pointer;background:transparent;border:none;border-left:1px solid var(--border-default);color:var(--text-secondary);font-family:var(--font-sans);font-size:var(--fs-body-sm);white-space:nowrap;}
.ath-kql__time:hover{background:var(--surface-raised);color:var(--text-primary);}
.ath-kql__time svg{width:15px;height:15px;color:var(--text-tertiary);}
.ath-kql__run{display:flex;align-items:center;gap:7px;padding:0 16px;flex:none;cursor:pointer;background:var(--brand);border:none;color:#fff;font-family:var(--font-sans);font-size:var(--fs-body-sm);font-weight:var(--fw-semibold);}
.ath-kql__run:hover{background:var(--brand-hover);}
.ath-kql__run svg{width:14px;height:14px;}
.tok-field{color:var(--syntax-field);}
.tok-op{color:var(--syntax-operator);}
.tok-kw{color:var(--syntax-keyword);font-weight:var(--fw-semibold);}
.tok-str{color:var(--syntax-string);}
.tok-num{color:var(--syntax-number);}
.tok-paren{color:var(--text-tertiary);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'kql');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const KEYWORDS = new Set(['and', 'or', 'not', 'AND', 'OR', 'NOT', 'by', 'where', 'sequence']);

function highlight(q) {
  // Tokenize into field/operator/keyword/string/number/paren/plain runs.
  const parts = q.split(/("[^"]*"|\s+|[():]|[<>=!]+|\band\b|\bor\b|\bnot\b)/gi).filter((s) => s !== '' && s != null);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i];
    if (/^\s+$/.test(t)) { out.push(t); continue; }
    if (/^".*"$/.test(t)) { out.push(<span key={i} className="tok-str">{t}</span>); continue; }
    if (t === ':' || /^[<>=!]+$/.test(t)) { out.push(<span key={i} className="tok-op">{t}</span>); continue; }
    if (t === '(' || t === ')') { out.push(<span key={i} className="tok-paren">{t}</span>); continue; }
    if (KEYWORDS.has(t)) { out.push(<span key={i} className="tok-kw">{t}</span>); continue; }
    if (/^-?\d+(\.\d+)?$/.test(t)) { out.push(<span key={i} className="tok-num">{t}</span>); continue; }
    // field if the next non-space token is ':' or operator
    let j = i + 1; while (parts[j] && /^\s+$/.test(parts[j])) j++;
    if (parts[j] === ':' || /^[<>=!]+$/.test(parts[j] || '')) { out.push(<span key={i} className="tok-field">{t}</span>); continue; }
    out.push(<span key={i}>{t}</span>);
  }
  return out;
}

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
  ...rest
}) {
  inject();
  const inputRef = React.useRef(null);
  const hlRef = React.useRef(null);
  const syncScroll = () => { if (hlRef.current && inputRef.current) hlRef.current.scrollLeft = inputRef.current.scrollLeft; };
  return (
    <div className={`ath-kql ${className}`} {...rest}>
      <button type="button" className="ath-kql__lang" onClick={onToggleLanguage} title="Toggle query language">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
        {language}
      </button>
      <div className="ath-kql__field">
        <span className="ath-kql__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <div className="ath-kql__editwrap">
          <div className="ath-kql__hl" ref={hlRef} aria-hidden="true">{value ? highlight(value) : ''}</div>
          <input
            ref={inputRef}
            className={`ath-kql__input ${value ? '' : 'ath-kql--empty'}`}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onScroll={syncScroll}
            onChange={(e) => onChange && onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onRun) onRun(value); }}
            {...rest}
          />
        </div>
      </div>
      <button type="button" className="ath-kql__time" onClick={onTimeClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
        {timeRange}
      </button>
      <button type="button" className="ath-kql__run" onClick={() => onRun && onRun(value)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 3 19 12 5 21 5 3"/></svg>
        Run
      </button>
    </div>
  );
}
