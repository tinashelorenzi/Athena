'use client';
import React from 'react';
import { Row, Col, Card, Menu, Input, Table, Button, Flex, Space, Typography, Tag, theme } from 'antd';
import { CaretRightOutlined, DatabaseOutlined, CheckCircleFilled, FileTextOutlined } from '@ant-design/icons';
import * as OS from '@/components/ds';
import { AthenaData } from '@/lib/data';

/* OSQuery — run SQL against simulated endpoints. */
const SAVED = ['Running processes not on disk', 'Startup items', 'Logged-in users', 'Listening ports', 'Scheduled tasks', 'Recently modified files'];

export function OsqueryScreen() {
  const { token } = theme.useToken();
  const [sql, setSql] = React.useState("SELECT name, path, pid, uid, on_disk\nFROM processes\nWHERE on_disk = 1 AND path LIKE 'C:\\ProgramData%';");
  const res = AthenaData.osqueryResult;
  const mono = { fontFamily: token.fontFamilyCode, fontSize: 12.5 };
  const monoCell = (v) => <span style={mono}>{v}</span>;

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <OS.PageHeader title="OSQuery" description="Query endpoint state with SQL across the simulated fleet." />

      <Row gutter={[16, 16]} wrap={false}>
        <Col flex="250px">
          <Card title="Saved queries" size="small" styles={{ body: { padding: 4 } }}>
            <Menu
              mode="inline"
              defaultSelectedKeys={[SAVED[0]]}
              style={{ borderInlineEnd: 0 }}
              items={SAVED.map((s) => ({ key: s, icon: <FileTextOutlined />, label: s }))}
            />
          </Card>
        </Col>
        <Col flex="auto" style={{ minWidth: 0 }}>
          <Flex vertical gap={16}>
            <Card
              size="small"
              title={
                <Space size={8}>
                  <DatabaseOutlined style={{ color: token.colorTextTertiary }} />
                  <Typography.Text type="secondary" style={{ fontWeight: 400 }}>Target</Typography.Text>
                  <Tag style={{ ...mono, marginInlineEnd: 0 }}>win-ep-04</Tag>
                </Space>
              }
              extra={<Button type="primary" icon={<CaretRightOutlined />}>Run query</Button>}
            >
              <Input.TextArea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                spellCheck={false}
                autoSize={{ minRows: 4, maxRows: 12 }}
                style={{ fontFamily: token.fontFamilyCode, fontSize: 13, lineHeight: 1.6 }}
              />
            </Card>

            <Card
              size="small"
              title={
                <Space size={8}>
                  <CheckCircleFilled style={{ color: token.colorSuccess }} />
                  <span>{res.length} rows</span>
                  <Typography.Text type="secondary" style={{ fontWeight: 400 }}>· 42 ms</Typography.Text>
                </Space>
              }
              styles={{ body: { padding: 0 } }}
            >
              <Table
                size="small"
                rowKey="pid"
                pagination={false}
                scroll={{ x: 'max-content' }}
                dataSource={res}
                columns={[
                  { key: 'name', dataIndex: 'name', title: 'name', render: (v) => <span style={{ ...mono, fontWeight: 500 }}>{v}</span> },
                  { key: 'path', dataIndex: 'path', title: 'path', render: monoCell },
                  { key: 'pid', dataIndex: 'pid', title: 'pid', align: 'right', width: 90, render: monoCell },
                  { key: 'uid', dataIndex: 'uid', title: 'uid', width: 130, render: monoCell },
                  { key: 'on_disk', dataIndex: 'on_disk', title: 'on_disk', align: 'right', width: 100, render: monoCell },
                ]}
              />
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
}

export default OsqueryScreen;
