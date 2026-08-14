'use client';
import React, { useMemo, useState, useTransition } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { checkGuidePrompt } from '@/app/actions/guide';
import { injectGuideCss, renderGuideHtml, splitGuide } from '@/components/guideMarkdown';

/* Renders a scenario's teaching guide: the authored markdown (images served
   from the guide asset route) with inline, interactive CTF prompts. */
export function GuideView({ scenarioId, markdown, prompts, solvedIds }) {
  injectGuideCss();
  const assetBase = `/api/scenarios/${scenarioId}/guide/`;
  const promptMap = useMemo(() => Object.fromEntries((prompts || []).map((p) => [p.id, p])), [prompts]);
  const parts = useMemo(() => splitGuide(markdown), [markdown]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {parts.map((chunk, i) => {
        if (i % 2 === 1) {
          const p = promptMap[chunk];
          return p ? <GuidePrompt key={`p-${chunk}`} scenarioId={scenarioId} prompt={p} initiallySolved={(solvedIds || []).includes(chunk)} /> : null;
        }
        if (!chunk.trim()) return null;
        return <div key={`t-${i}`} className="ath-guide" dangerouslySetInnerHTML={{ __html: renderGuideHtml(chunk, assetBase) }} />;
      })}
    </div>
  );
}

function GuidePrompt({ scenarioId, prompt, initiallySolved }) {
  const [answer, setAnswer] = useState('');
  const [solved, setSolved] = useState(initiallySolved);
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(null);
  const [busy, start] = useTransition();

  const submit = () => {
    if (!answer.trim() || solved) return;
    setWrong(false); setHint(null);
    start(async () => {
      const res = await checkGuidePrompt(scenarioId, prompt.id, answer);
      if (res.error) { setWrong(true); setHint(res.error); return; }
      if (res.correct) { setSolved(true); }
      else { setWrong(true); setHint(res.hint || null); }
    });
  };

  return (
    <div style={{
      margin: '10px 0', borderRadius: 'var(--radius-sm)', border: '1px solid ' + (solved ? 'var(--status-success, #22c55e)' : 'var(--accent-subtle-border, rgba(124,140,255,0.3))'),
      background: solved ? 'var(--success-subtle-bg, rgba(34,197,94,0.08))' : 'var(--accent-subtle-bg, rgba(124,140,255,0.06))', padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon name={solved ? 'CircleCheck' : 'Flag'} size={16} style={{ color: solved ? 'var(--status-success, #22c55e)' : 'var(--accent, #7c8cff)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Prompt{prompt.points ? ` · ${prompt.points} pts` : ''}</span>
        {solved && <AC.Badge tone="success" square>Solved</AC.Badge>}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.5 }}>{prompt.question}</div>
      {solved ? (
        <div style={{ fontSize: 13, color: 'var(--status-success, #22c55e)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="Check" size={15} /> Correct — nice work.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <AC.Input value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} placeholder="Your answer" mono leadingIcon={<Icon name="Flag" size={15} />} />
            </div>
            <AC.Button variant="primary" size="md" loading={busy} onClick={submit}>Check</AC.Button>
          </div>
          {wrong && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--status-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="X" size={14} /> Not quite.{hint ? ` Hint: ${hint}` : ''}</div>}
        </>
      )}
    </div>
  );
}

export default GuideView;
