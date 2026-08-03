/* Copyable example bundles for the scenario builder's JSON sections. These
   mirror docs/scenario-schemas.md and pass the validators in
   src/lib/scenario-schemas.ts. Kept as pretty-printed strings for display. */
const logs = {
  version: 1,
  entries: [
    { ts: '2026-07-01T14:32:07.412Z', host: 'win-ep-04', source: 'sysmon', action: 'process_start', user: 'svc-batch', message: 'powershell.exe -nop -w hidden -enc SQBFAFgA...', fields: { pid: 6624, ppid: 4188 } },
    { ts: '2026-07-01T14:31:52.006Z', host: 'win-ep-04', source: 'sysmon', action: 'process_start', user: 'svc-batch', message: 'vssadmin.exe delete shadows /all /quiet', fields: { pid: 7710, ppid: 6624 } },
    { ts: '2026-07-01T14:29:51.145Z', host: 'lnx-jump-01', source: 'auth', action: 'authentication', user: 'root', message: 'Accepted password for root from 203.0.113.9 port 51022' },
  ],
};

const alerts = {
  version: 1,
  alerts: [
    { id: 'ALT-4821', seek: 0, title: 'Encoded PowerShell command executed', host: 'win-ep-04', source: '10.0.0.5', destination: '185.220.101.34', rule: 'T1059.001', count: 24 },
    { id: 'ALT-4818', seek: 45, title: 'Multiple failed SSH logins then success', host: 'lnx-jump-01', source: '203.0.113.9', rule: 'T1110', count: 112 },
    { id: 'ALT-4815', seek: 130, title: 'Outbound connection to known C2', host: 'win-ep-04', destination: '185.220.101.34', rule: 'T1071', count: 3 },
  ],
};

const edr = {
  version: 1,
  hostname: 'win-ep-04',
  os: 'Windows 11',
  processes: [
    {
      pid: 4188, ppid: 812, name: 'winword.exe', user: 'j.mensah', cmd: 'WINWORD.EXE /n Invoice_July.docm',
      children: [
        { pid: 6624, ppid: 4188, name: 'powershell.exe', user: 'svc-batch', cmd: 'powershell -nop -w hidden -enc SQBFAFgA...', children: [
          { pid: 7710, ppid: 6624, name: 'vssadmin.exe', user: 'svc-batch', cmd: 'vssadmin delete shadows /all /quiet', children: [] },
        ] },
      ],
    },
  ],
  connections: [
    { proto: 'TCP', laddr: '10.0.0.5:51344', raddr: '185.220.101.34:4444', state: 'ESTABLISHED', pid: 6624 },
  ],
  browserHistory: [
    { ts: '2026-07-01T14:26:58Z', title: 'Invoice payment portal', url: 'http://pay-invoice-verify.top/login' },
  ],
  shellHistory: [
    { ts: '2026-07-01T14:32:07Z', user: 'svc-batch', cmd: 'powershell -nop -w hidden -enc SQBFAFgA...' },
  ],
};

const osquery = {
  version: 1,
  hostname: 'win-ep-04',
  tables: {
    processes: [
      { pid: 6624, name: 'svc.exe', path: 'C:\\ProgramData\\svc.exe', cmdline: 'svc.exe', parent: 4188, uid: 'svc-batch', on_disk: 1 },
    ],
    listening_ports: [
      { pid: 6624, port: 4444, protocol: 'tcp', address: '0.0.0.0' },
    ],
    scheduled_tasks: [
      { name: 'Updater', action: 'C:\\ProgramData\\svc.exe', path: '\\Microsoft\\Windows\\Updater', enabled: 1, hidden: 0 },
    ],
    users: [
      { uid: '1001', username: 'j.mensah', directory: 'C:\\Users\\j.mensah' },
    ],
  },
};

const pretty = (o) => JSON.stringify(o, null, 2);

export const EXAMPLES = {
  logs: pretty(logs),
  alerts: pretty(alerts),
  edr: pretty(edr),
  osquery: pretty(osquery),
};

export default EXAMPLES;
