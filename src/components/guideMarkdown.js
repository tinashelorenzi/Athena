import { marked } from 'marked';

/* Shared guide markdown rendering (used by the student GuideView and the
   instructor GuidePreview). Renders authored markdown with marked and rewrites
   relative image srcs to the authorized guide-asset route. */
const CSS = `
.ath-guide{color:var(--text-secondary);font-size:14px;line-height:1.65;}
.ath-guide h1,.ath-guide h2,.ath-guide h3,.ath-guide h4{color:var(--text-primary);font-weight:600;letter-spacing:-0.01em;margin:1.3em 0 0.5em;line-height:1.3;}
.ath-guide h1{font-size:24px;} .ath-guide h2{font-size:19px;} .ath-guide h3{font-size:16px;} .ath-guide h4{font-size:14px;}
.ath-guide p{margin:0 0 0.85em;} .ath-guide ul,.ath-guide ol{margin:0 0 0.85em;padding-left:22px;} .ath-guide li{margin:3px 0;}
.ath-guide code{font-family:var(--font-mono);font-size:12.5px;background:var(--surface-inset);border:1px solid var(--border-subtle);border-radius:4px;padding:1px 5px;}
.ath-guide pre{background:var(--surface-inset);border:1px solid var(--border-default);border-radius:8px;padding:12px 14px;overflow:auto;margin:0 0 0.9em;}
.ath-guide pre code{background:none;border:none;padding:0;}
.ath-guide a{color:var(--accent,#7c8cff);}
.ath-guide img{max-width:100%;border-radius:8px;border:1px solid var(--border-default);margin:6px 0;}
.ath-guide blockquote{margin:0 0 0.85em;padding:2px 14px;border-left:3px solid var(--border-strong,var(--border-default));color:var(--text-tertiary);}
.ath-guide table{border-collapse:collapse;margin:0 0 0.9em;font-size:13px;} .ath-guide th,.ath-guide td{border:1px solid var(--border-default);padding:6px 10px;text-align:left;}
.ath-guide hr{border:none;border-top:1px solid var(--border-subtle);margin:1.4em 0;}
`;
let injected = false;
export function injectGuideCss() {
  if (injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
  injected = true;
}

function resolveSrc(src, base) {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('data:') || src.startsWith('#')) return src;
  return base + src.replace(/^\.\//, '');
}

export function renderGuideHtml(md, assetBase) {
  let html = String(marked.parse(md ?? '', { async: false, gfm: true }));
  html = html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/g, (_m, pre, src, post) => pre + resolveSrc(src, assetBase) + post);
  return html;
}

/** Split guide markdown on the [[prompt:id]] sentinels: even chunks are markdown
    text, odd chunks are prompt ids. */
export function splitGuide(markdown) {
  return String(markdown || '').split(/\[\[prompt:(\w+)\]\]/);
}
