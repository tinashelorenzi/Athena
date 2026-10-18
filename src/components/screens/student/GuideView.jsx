'use client';
import React, { useMemo, useState, useTransition } from 'react';
import { Card, Flex, Typography, Tag, Input, Button, Space, Alert, theme } from 'antd';
import { CheckCircleFilled, CheckOutlined, FlagOutlined } from '@ant-design/icons';
import { checkGuidePrompt } from '@/app/actions/guide';
import { injectGuideCss, renderGuideHtml, splitGuide } from '@/components/guideMarkdown';

const { Text, Paragraph } = Typography;

/* Renders a scenario's teaching guide: the authored markdown (images served
   from the guide asset route) with inline, interactive CTF prompts. */
export function GuideView({ scenarioId, markdown, prompts, solvedIds, onPromptSolved, preview }) {
  injectGuideCss();
  const assetBase = `/api/scenarios/${scenarioId}/guide/`;
  const promptMap = useMemo(() => Object.fromEntries((prompts || []).map((p) => [String(p.id), p])), [prompts]);
  const parts = useMemo(() => splitGuide(markdown), [markdown]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {parts.map((chunk, i) => {
        if (i % 2 === 1) {
          const p = promptMap[chunk];
          return p ? <GuidePrompt key={`p-${chunk}`} scenarioId={scenarioId} prompt={p} solved={(solvedIds || []).includes(chunk)} onSolved={onPromptSolved} preview={preview} /> : null;
        }
        if (!chunk.trim()) return null;
        return <div key={`t-${i}`} className="ath-guide" dangerouslySetInnerHTML={{ __html: renderGuideHtml(chunk, assetBase) }} />;
      })}
    </div>
  );
}

function GuidePrompt({ scenarioId, prompt, solved, onSolved, preview }) {
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(null);
  const [busy, start] = useTransition();
  const { token } = theme.useToken();

  const submit = () => {
    if (!answer.trim() || solved) return;
    setWrong(false); setHint(null);
    if (preview) {
      // Ephemeral: check locally against the answer (instructor preview only).
      const ok = answer.trim().toLowerCase() === String(prompt.answer ?? '').trim().toLowerCase();
      if (ok) onSolved?.(prompt.id); else { setWrong(true); setHint(prompt.hint || null); }
      return;
    }
    start(async () => {
      const res = await checkGuidePrompt(scenarioId, prompt.id, answer);
      if (res.error) { setWrong(true); setHint(res.error); return; }
      if (res.correct) { onSolved?.(prompt.id); }
      else { setWrong(true); setHint(res.hint || null); }
    });
  };

  return (
    <Card
      size="small"
      style={{ margin: '10px 0', borderColor: solved ? token.colorSuccessBorder : token.colorPrimaryBorder, background: solved ? token.colorSuccessBg : token.colorPrimaryBg }}
    >
      <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
        {solved ? <CheckCircleFilled style={{ color: token.colorSuccess }} /> : <FlagOutlined style={{ color: token.colorPrimary }} />}
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Checkpoint{prompt.points ? ` · ${prompt.points} pts` : ''}</Text>
        {solved && <Tag color="success">Solved</Tag>}
      </Flex>
      <Paragraph style={{ fontSize: 14, marginBottom: 10 }}>{prompt.question}</Paragraph>
      {solved ? (
        <Text type="success"><CheckOutlined /> Correct — nice work.</Text>
      ) : (
        <Flex vertical gap={8}>
          <Space.Compact block>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onPressEnter={(e) => { e.preventDefault(); submit(); }}
              placeholder="Your answer"
              prefix={<FlagOutlined />}
              status={wrong ? 'error' : undefined}
              style={{ fontFamily: token.fontFamilyCode }}
            />
            <Button type="primary" loading={busy} onClick={submit}>Check</Button>
          </Space.Compact>
          {wrong && <Alert type="error" showIcon title={`Not quite.${hint ? ` Hint: ${hint}` : ''}`} />}
        </Flex>
      )}
    </Card>
  );
}

export default GuideView;
