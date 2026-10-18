'use client';
import React, { useMemo } from 'react';
import { Card, Descriptions, Flex, Tag, Typography, theme } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import { injectGuideCss, renderGuideHtml, splitGuide } from '@/components/guideMarkdown';

/* Instructor-side guide preview — renders the guide exactly as students see it,
   but reveals each prompt's answer/hint (non-interactive). */
export function GuidePreview({ scenarioId, markdown, prompts }) {
  injectGuideCss();
  const assetBase = `/api/scenarios/${scenarioId}/guide/`;
  const promptMap = useMemo(() => Object.fromEntries((prompts || []).map((p) => [String(p.id), p])), [prompts]);
  const parts = useMemo(() => splitGuide(markdown), [markdown]);

  return (
    <Flex vertical gap={4}>
      {parts.map((chunk, i) => {
        if (i % 2 === 1) {
          const p = promptMap[chunk];
          return p ? <PreviewPrompt key={`p-${chunk}`} prompt={p} /> : null;
        }
        if (!chunk.trim()) return null;
        return <div key={`t-${i}`} className="ath-guide" dangerouslySetInnerHTML={{ __html: renderGuideHtml(chunk, assetBase) }} />;
      })}
    </Flex>
  );
}

function PreviewPrompt({ prompt }) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      style={{ margin: '10px 0', borderColor: token.colorPrimaryBorder, background: token.colorPrimaryBg }}
      title={<Flex align="center" gap={8}><FlagOutlined style={{ color: token.colorPrimary }} />Prompt{prompt.points ? <Tag>{prompt.points} pts</Tag> : null}</Flex>}
    >
      <Typography.Paragraph style={{ marginBottom: 8 }}>{prompt.question}</Typography.Paragraph>
      <Descriptions size="small" column={1} items={[
        { key: 'a', label: 'Answer', children: <Typography.Text code type="success">{prompt.answer}</Typography.Text> },
        ...(prompt.hint ? [{ key: 'h', label: 'Hint', children: <Typography.Text type="secondary">{prompt.hint}</Typography.Text> }] : []),
      ]} />
    </Card>
  );
}

export default GuidePreview;
