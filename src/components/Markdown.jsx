'use client';
import React from 'react';
import { Marked } from 'marked';

/* Markdown renderer for scenario/lab briefs, lab feedback and ATT&CK prose.
   GitHub-flavoured (tables, task lists, strikethrough, ordered lists, quotes).
   Raw HTML in the source is escaped rather than rendered, and links only allow
   http(s)/mailto/relative targets, so authored markdown renders safely. */
const CSS = `
.ath-md{color:var(--text-secondary);font-size:14px;line-height:1.6;}
.ath-md h1,.ath-md h2,.ath-md h3,.ath-md h4{color:var(--text-primary);font-weight:600;letter-spacing:-0.01em;margin:1.1em 0 0.5em;line-height:1.3;}
.ath-md h1{font-size:22px;} .ath-md h2{font-size:18px;} .ath-md h3{font-size:15.5px;} .ath-md h4{font-size:14px;}
.ath-md > :first-child{margin-top:0;} .ath-md > :last-child{margin-bottom:0;}
.ath-md p{margin:0 0 0.8em;} .ath-md ul,.ath-md ol{margin:0 0 0.8em;padding-left:22px;} .ath-md li{margin:2px 0;}
.ath-md li > ul,.ath-md li > ol{margin:2px 0 0;}
.ath-md code{font-family:var(--font-mono);font-size:12.5px;background:var(--surface-inset);border:1px solid var(--border-subtle);border-radius:4px;padding:1px 5px;}
.ath-md pre{background:var(--surface-inset);border:1px solid var(--border-default);border-radius:8px;padding:12px 14px;overflow:auto;margin:0 0 0.9em;}
.ath-md pre code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.5;}
.ath-md a{color:var(--accent,#7c8cff);}
.ath-md strong{color:var(--text-primary);}
.ath-md blockquote{margin:0 0 0.8em;padding:2px 14px;border-left:3px solid var(--border-strong,var(--border-default));color:var(--text-tertiary);}
.ath-md hr{border:none;border-top:1px solid var(--border-subtle);margin:1.2em 0;}
.ath-md img{max-width:100%;border-radius:8px;}
.ath-md .ath-md-table{overflow-x:auto;margin:0 0 0.9em;}
.ath-md table{border-collapse:collapse;font-size:13px;min-width:50%;}
.ath-md th,.ath-md td{border:1px solid var(--border-default);padding:6px 10px;text-align:left;vertical-align:top;}
.ath-md th{background:var(--surface-inset);color:var(--text-primary);font-weight:600;}
.ath-md input[type=checkbox]{margin:0 6px 0 0;vertical-align:middle;}
.ath-md ul:has(> li > input[type=checkbox]){list-style:none;padding-left:4px;}
`;
let injected = false;
function inject() { if (injected || typeof document === 'undefined') return; const el = document.createElement('style'); el.textContent = CSS; document.head.appendChild(el); injected = true; }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeHref = (href) => (/^(https?:|mailto:|\/|#|\.)/i.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : null);

const md = new Marked({ gfm: true, async: false });
md.use({
  renderer: {
    // Raw HTML (block or inline) shows as text, as it always has.
    html({ text }) { return esc(text); },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const url = safeHref(href || '');
      if (url === null) return label;
      return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''} target="_blank" rel="noreferrer">${label}</a>`;
    },
    image({ href, title, text }) {
      const url = safeHref(href || '');
      if (url === null) return esc(text);
      return `<img src="${esc(url)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''}>`;
    },
  },
});
// Wide tables scroll inside the card instead of stretching it.
md.use({
  hooks: {
    postprocess: (html) => html.replace(/<table>/g, '<div class="ath-md-table"><table>').replace(/<\/table>/g, '</table></div>'),
  },
});

function render(source) {
  return String(md.parse(String(source || '').replace(/\r\n/g, '\n')));
}

export function Markdown({ children }) {
  inject();
  return <div className="ath-md" dangerouslySetInnerHTML={{ __html: render(children) }} />;
}

export default Markdown;
