/* Athena × Ant Design theme. Maps the Zaio brand onto antd's token system so
   every core component (Button, Table, Menu, Tag, …) picks it up. Semantic
   colours mirror src/app/tokens/colors.css; keep the two in step. */
export const athenaTheme = {
  cssVar: { prefix: 'ath' },
  hashed: false,
  token: {
    colorPrimary: '#3538D4',
    colorInfo: '#3538D4',
    colorLink: '#2326B8',
    colorSuccess: '#17915A',
    colorWarning: '#D9A400',
    colorError: '#D92D3C',
    colorBgLayout: '#F4F6FB',
    colorBorder: '#DCE3EF',
    colorBorderSecondary: '#EBEFF6',
    colorText: '#161D2E',
    colorTextSecondary: '#566076',
    colorTextTertiary: '#7B869F',
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyCode: "'IBM Plex Mono', SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 14,
    borderRadius: 8,
    borderRadiusLG: 12,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 56,
      headerPadding: '0 24px',
      siderBg: '#FFFFFF',
      bodyBg: '#F4F6FB',
    },
    Menu: {
      itemBorderRadius: 8,
      itemHeight: 38,
      itemSelectedBg: 'rgba(53, 56, 212, 0.09)',
      itemSelectedColor: '#2326B8',
      groupTitleFontSize: 11,
    },
    Card: { headerFontSize: 15 },
    Table: { headerBg: '#F7F9FC', headerColor: '#566076', rowHoverBg: '#F4F6FB' },
    Tabs: { titleFontSize: 14 },
    Statistic: { titleFontSize: 13 },
  },
};

/* SOC severity → antd preset tag colour + hex (for charts / dots). */
export const SEVERITY = {
  critical: { color: 'red', hex: '#D92D3C', label: 'Critical' },
  high: { color: 'volcano', hex: '#D9691A', label: 'High' },
  medium: { color: 'gold', hex: '#C79E00', label: 'Medium' },
  low: { color: 'geekblue', hex: '#3538D4', label: 'Low' },
  info: { color: 'default', hex: '#7B869F', label: 'Info' },
};

export default athenaTheme;
