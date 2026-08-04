'use client';
import React from 'react';

/* Minimal, dependency-free Markdown renderer for scenario briefs. Input is
   escaped first, so instructor-authored markdown renders safely (headings,
   bold/italic, inline code, code fences, lists, links). */
const CSS = `
.ath-md{color:var(--text-secondary);font-size:14px;line-height:1.6;}
.ath-md h1,.ath-md h2,.ath-md h3,.ath-md h4{color:var(--text-primary);font-weight:600;letter-spacing:-0.01em;margin:1.1em 0 0.5em;line-height:1.3;}
.ath-md h1{font-size:22px;} .ath-md h2{font-size:18px;} .ath-md h3{font-size:15.5px;} .ath-md h4{font-size:14px;}
.ath-md p{margin:0 0 0.8em;} .ath-md ul{margin:0 0 0.8em;padding-left:20px;} .ath-md li{margin:2px 0;}
.ath-md code{font-family:var(--font-mono);font-size:12.5px;background:var(--surface-inset);border:1px solid var(--border-subtle);border-radius:4px;padding:1px 5px;}
.ath-md pre{background:var(--surface-inset);border:1px solid var(--border-default);border-radius:8px;padding:12px 14px;overflow:auto;margin:0 0 0.9em;}
.ath-md pre code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.5;}
.ath-md a{color:var(--accent,#7c8cff);}
`;
let injected = false;
function inject() { if (injected || typeof document === 'undefined') return; const el = document.createElement('style'); el.textContent = CSS; document.head.appendChild(el); injected = true; }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return t;
}

function render(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false, inCode = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (inCode) { html += '</code></pre>'; inCode = false; }
      else { closeList(); html += '<pre><code>'; inCode = true; }
      continue;
    }
    if (inCode) { html += esc(raw) + '\n'; continue; }
    if (/^\s*[-*]\s+/.test(raw)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + inline(raw.replace(/^\s*[-*]\s+/, '')) + '</li>';
      continue;
    }
    closeList();
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const l = h[1].length; html += `<h${l}>${inline(h[2])}</h${l}>`; continue; }
    if (raw.trim() === '') continue;
    html += '<p>' + inline(raw) + '</p>';
  }
  if (inCode) html += '</code></pre>';
  closeList();
  return html;
}

export function Markdown({ children }) {
  inject();
  return <div className="ath-md" dangerouslySetInnerHTML={{ __html: render(children) }} />;
}

export default Markdown;
