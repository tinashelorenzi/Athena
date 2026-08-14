'use client';
import React, { useMemo } from 'react';
import { Icon } from '@/components/Icon';
import { injectGuideCss, renderGuideHtml, splitGuide } from '@/components/guideMarkdown';

/* Instructor-side guide preview — renders the guide exactly as students see it,
   but reveals each prompt's answer/hint (non-interactive). */
export function GuidePreview({ scenarioId, markdown, prompts }) {
  injectGuideCss();
  const assetBase = `/api/scenarios/${scenarioId}/guide/`;
  const promptMap = useMemo(() => Object.fromEntries((prompts || []).map((p) => [String(p.id), p])), [prompts]);
  const parts = useMemo(() => splitGuide(markdown), [markdown]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {parts.map((chunk, i) => {
        if (i % 2 === 1) {
          const p = promptMap[chunk];
          return p ? <PreviewPrompt key={`p-${chunk}`} prompt={p} /> : null;
        }
        if (!chunk.trim()) return null;
        return <div key={`t-${i}`} className="ath-guide" dangerouslySetInnerHTML={{ __html: renderGuideHtml(chunk, assetBase) }} />;
      })}
    </div>
  );
}

function PreviewPrompt({ prompt }) {
  return (
    <div style={{ margin: '10px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-subtle-border, rgba(124,140,255,0.3))', background: 'var(--accent-subtle-bg, rgba(124,140,255,0.06))', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon name="Flag" size={16} style={{ color: 'var(--accent, #7c8cff)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Prompt{prompt.points ? ` · ${prompt.points} pts` : ''}</span>
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 10 }}>{prompt.question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5 }}>
        <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--text-tertiary)', width: 56, flex: 'none' }}>Answer</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-success, #22c55e)' }}>{prompt.answer}</span></div>
        {prompt.hint && <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--text-tertiary)', width: 56, flex: 'none' }}>Hint</span><span style={{ color: 'var(--text-secondary)' }}>{prompt.hint}</span></div>}
      </div>
    </div>
  );
}

export default GuidePreview;
