/* Athena UI kit — shared mock data (SOC scenario: "Ransomware in Finance") */
export const AthenaData = (function () {
  const alerts = [
    { id: 'ALT-4821', sev: 'critical', time: '2026-07-01 14:32:07', rule: 'Encoded PowerShell command executed', host: 'win-ep-04', src: '10.0.0.5', dst: '185.220.101.34', tactic: 'Execution', technique: 'T1059.001', status: 'open', assignee: null, count: 24 },
    { id: 'ALT-4820', sev: 'critical', time: '2026-07-01 14:31:52', rule: 'Shadow copies deleted (vssadmin)', host: 'win-ep-04', src: '10.0.0.5', dst: '—', tactic: 'Impact', technique: 'T1490', status: 'open', assignee: null, count: 1 },
    { id: 'ALT-4818', sev: 'high', time: '2026-07-01 14:29:51', rule: 'Multiple failed SSH logins then success', host: 'lnx-jump-01', src: '203.0.113.9', dst: '10.0.0.9', tactic: 'Credential Access', technique: 'T1110', status: 'in_progress', assignee: 'You', count: 112 },
    { id: 'ALT-4815', sev: 'high', time: '2026-07-01 14:27:14', rule: 'Outbound connection to known C2', host: 'win-ep-04', src: '10.0.0.5', dst: '185.220.101.34', tactic: 'Command & Control', technique: 'T1071', status: 'open', assignee: null, count: 3 },
    { id: 'ALT-4809', sev: 'medium', time: '2026-07-01 14:19:03', rule: 'Scheduled task created in user context', host: 'win-ep-11', src: '10.0.0.22', dst: '—', tactic: 'Persistence', technique: 'T1053.005', status: 'open', assignee: 'A. Okafor', count: 2 },
    { id: 'ALT-4804', sev: 'medium', time: '2026-07-01 14:12:40', rule: 'LSASS memory access by non-system process', host: 'win-ep-04', src: '10.0.0.5', dst: '—', tactic: 'Credential Access', technique: 'T1003.001', status: 'escalated', assignee: 'You', count: 1 },
    { id: 'ALT-4798', sev: 'low', time: '2026-07-01 14:03:22', rule: 'New local admin account created', host: 'win-ep-11', src: '10.0.0.22', dst: '—', tactic: 'Persistence', technique: 'T1136.001', status: 'open', assignee: null, count: 1 },
    { id: 'ALT-4790', sev: 'low', time: '2026-07-01 13:58:11', rule: 'RDP session from internal host', host: 'win-ep-04', src: '10.0.0.9', dst: '10.0.0.5', tactic: 'Lateral Movement', technique: 'T1021.001', status: 'resolved', assignee: 'S. Lee', count: 5 },
    { id: 'ALT-4781', sev: 'info', time: '2026-07-01 13:44:57', rule: 'USB mass storage device connected', host: 'win-ep-22', src: '10.0.0.31', dst: '—', tactic: 'Initial Access', technique: 'T1091', status: 'open', assignee: null, count: 1 },
  ];

  const logs = [
    { t: '2026-07-01 14:32:07.412', level: 'critical', host: 'win-ep-04', action: 'process_start', user: 'svc-batch', msg: 'powershell.exe -enc SQBFAFgAKABJAFcAUg... ', pid: 6624, ppid: 4188 },
    { t: '2026-07-01 14:32:06.981', level: 'notice', host: 'win-ep-04', action: 'network_connection', user: 'svc-batch', msg: 'Outbound TCP 10.0.0.5:51344 → 185.220.101.34:4444', pid: 6624, ppid: 4188 },
    { t: '2026-07-01 14:31:52.006', level: 'warning', host: 'win-ep-04', action: 'process_start', user: 'svc-batch', msg: 'vssadmin.exe delete shadows /all /quiet', pid: 7710, ppid: 6624 },
    { t: '2026-07-01 14:31:11.774', level: 'notice', host: 'win-ep-04', action: 'file_create', user: 'svc-batch', msg: 'C:\\Users\\Public\\readme_RECOVER.txt', pid: 6624, ppid: 4188 },
    { t: '2026-07-01 14:30:58.320', level: 'info', host: 'win-ep-04', action: 'registry_set', user: 'svc-batch', msg: 'HKCU\\...\\Run\\Updater = C:\\ProgramData\\svc.exe', pid: 6624, ppid: 4188 },
    { t: '2026-07-01 14:29:51.145', level: 'warning', host: 'lnx-jump-01', action: 'authentication', user: 'root', msg: 'Accepted password for root from 203.0.113.9 port 51022', pid: 2231, ppid: 1 },
    { t: '2026-07-01 14:29:44.882', level: 'warning', host: 'lnx-jump-01', action: 'authentication', user: 'root', msg: 'Failed password for root from 203.0.113.9 port 51004', pid: 2230, ppid: 1 },
    { t: '2026-07-01 14:27:14.559', level: 'notice', host: 'win-ep-04', action: 'dns_query', user: 'svc-batch', msg: 'Query A pay-invoice-verify[.]top → 185.220.101.34', pid: 6624, ppid: 4188 },
    { t: '2026-07-01 14:19:03.201', level: 'info', host: 'win-ep-11', action: 'scheduled_task', user: 'j.mensah', msg: 'Created task \\Microsoft\\Windows\\Updater (daily 09:00)', pid: 3390, ppid: 812 },
    { t: '2026-07-01 14:12:40.088', level: 'warning', host: 'win-ep-04', action: 'process_access', user: 'svc-batch', msg: 'OpenProcess lsass.exe (0x1010) by rundll32.exe', pid: 6710, ppid: 6624 },
  ];

  const fields = [
    { name: 'event.action', count: 10, top: [['process_start', 3], ['authentication', 2], ['network_connection', 1]] },
    { name: 'host.name', count: 10, top: [['win-ep-04', 7], ['lnx-jump-01', 2], ['win-ep-11', 1]] },
    { name: 'user.name', count: 10, top: [['svc-batch', 7], ['root', 2], ['j.mensah', 1]] },
    { name: 'event.level', count: 10, top: [['notice', 3], ['warning', 4], ['info', 2]] },
    { name: 'process.pid', count: 10, top: [['6624', 5], ['7710', 1], ['2231', 1]] },
    { name: 'destination.ip', count: 4, top: [['185.220.101.34', 2], ['10.0.0.5', 1]] },
    { name: 'destination.port', count: 4, top: [['4444', 1], ['22', 1], ['443', 1]] },
  ];

  const histogram = [2, 1, 3, 2, 4, 3, 5, 8, 6, 4, 9, 12, 7, 14, 18, 11, 22, 16, 9, 6, 4, 3, 5, 2];

  const scenarios = [
    { id: 'SC-07', title: 'Ransomware in Finance', tag: 'Incident Response', difficulty: 'Advanced', mins: 90, status: 'active', progress: 4, total: 7, desc: 'A finance workstation shows signs of ransomware staging. Trace the intrusion from initial access to impact, contain the host, and preserve evidence.', tactics: ['Execution', 'Persistence', 'Impact'], color: 'critical' },
    { id: 'SC-04', title: 'Phishing → Credential Theft', tag: 'Email Security', difficulty: 'Intermediate', mins: 60, status: 'available', progress: 0, total: 5, desc: 'An employee reported a suspicious invoice email. Investigate the payload, identify compromised credentials, and scope the blast radius.', tactics: ['Initial Access', 'Credential Access'], color: 'high' },
    { id: 'SC-09', title: 'Suspicious DNS Beaconing', tag: 'Network Threat Hunting', difficulty: 'Intermediate', mins: 45, status: 'available', progress: 0, total: 4, desc: 'Periodic DNS queries to a newly registered domain suggest C2 beaconing. Hunt across logs to confirm and identify affected hosts.', tactics: ['Command & Control'], color: 'medium' },
    { id: 'SC-02', title: 'Insider Data Exfiltration', tag: 'DLP / Forensics', difficulty: 'Advanced', mins: 75, status: 'available', progress: 0, total: 6, desc: 'A departing employee may be exfiltrating files to removable media and personal cloud. Build the timeline from EDR and log evidence.', tactics: ['Collection', 'Exfiltration'], color: 'high' },
    { id: 'SC-11', title: 'Brute Force on Public SSH', tag: 'Perimeter Defense', difficulty: 'Beginner', mins: 30, status: 'completed', progress: 4, total: 4, desc: 'A public-facing jump host is under credential brute force. Detect the pattern, write a firewall rule, and verify containment.', tactics: ['Credential Access'], color: 'low' },
    { id: 'SC-06', title: 'Malicious Office Macro', tag: 'Malware Analysis', difficulty: 'Intermediate', mins: 60, status: 'available', progress: 0, total: 5, desc: 'A macro-enabled document dropped a second-stage payload. Analyze the sample in Forensics and extract IOCs for threat intel.', tactics: ['Execution', 'Defense Evasion'], color: 'medium' },
  ];

  const firewallRules = [
    { id: 1, enabled: true, action: 'deny', src: '203.0.113.9', dst: 'any', port: 'any', proto: 'any', hits: 1142, note: 'Block brute-force source' },
    { id: 2, enabled: true, action: 'deny', src: 'any', dst: '185.220.101.34', port: 'any', proto: 'any', hits: 27, note: 'C2 IP — scenario SC-07' },
    { id: 3, enabled: true, action: 'allow', src: '10.0.0.0/8', dst: '10.0.0.9', port: '22', proto: 'tcp', hits: 88, note: 'Internal SSH to jump host' },
    { id: 4, enabled: false, action: 'deny', src: 'any', dst: 'any', port: '4444', proto: 'tcp', hits: 0, note: 'Block Metasploit default (draft)' },
    { id: 5, enabled: true, action: 'allow', src: 'any', dst: '10.0.0.20', port: '443', proto: 'tcp', hits: 3401, note: 'HTTPS to web tier' },
  ];

  const utm = [
    { name: 'Intrusion Prevention', on: true, detail: '4,812 signatures · blocked 12 today' },
    { name: 'Anti-Malware Gateway', on: true, detail: 'Streaming scan · 3 quarantined' },
    { name: 'Web/URL Filtering', on: true, detail: 'Newly-registered domains blocked' },
    { name: 'DNS Filtering', on: false, detail: 'Not enabled for this scenario' },
  ];

  const processes = [
    { pid: 6624, name: 'powershell.exe', user: 'svc-batch', cpu: 42.1, mem: 128, ppid: 4188, parent: 'winword.exe', susp: true, cmd: 'powershell.exe -nop -w hidden -enc SQBFAFgAKABJAFcAUgAg...' },
    { pid: 7710, name: 'vssadmin.exe', user: 'svc-batch', cpu: 1.2, mem: 6, ppid: 6624, parent: 'powershell.exe', susp: true, cmd: 'vssadmin.exe delete shadows /all /quiet' },
    { pid: 6710, name: 'rundll32.exe', user: 'svc-batch', cpu: 0.4, mem: 12, ppid: 6624, parent: 'powershell.exe', susp: true, cmd: 'rundll32.exe comsvcs.dll MiniDump 700' },
    { pid: 4188, name: 'winword.exe', user: 'j.mensah', cpu: 3.4, mem: 210, ppid: 812, parent: 'explorer.exe', susp: false, cmd: 'WINWORD.EXE /n "Invoice_July.docm"' },
    { pid: 812, name: 'explorer.exe', user: 'j.mensah', cpu: 0.8, mem: 96, ppid: 640, parent: 'userinit.exe', susp: false, cmd: 'C:\\Windows\\explorer.exe' },
  ];

  const connections = [
    { proto: 'TCP', laddr: '10.0.0.5:51344', raddr: '185.220.101.34:4444', state: 'ESTABLISHED', pid: 6624, proc: 'powershell.exe', flag: 'c2' },
    { proto: 'UDP', laddr: '10.0.0.5:53', raddr: '185.220.101.34:53', state: '—', pid: 6624, proc: 'powershell.exe', flag: 'dns' },
    { proto: 'TCP', laddr: '10.0.0.5:445', raddr: '10.0.0.22:445', state: 'ESTABLISHED', pid: 4, proc: 'System', flag: 'smb' },
    { proto: 'TCP', laddr: '10.0.0.5:443', raddr: '10.0.0.20:443', state: 'ESTABLISHED', pid: 3120, proc: 'chrome.exe', flag: null },
  ];

  const browserHistory = [
    { t: '14:26:58', title: 'Invoice payment portal', url: 'pay-invoice-verify[.]top/login', flag: 'malicious' },
    { t: '14:26:31', title: 'Document — Invoice_July', url: 'file:///C:/Users/j.mensah/Downloads/Invoice_July.docm', flag: 'suspicious' },
    { t: '14:20:11', title: 'Webmail — Inbox', url: 'mail.zaio-finance.local/inbox', flag: null },
    { t: '13:58:02', title: 'Company intranet', url: 'intranet.zaio-finance.local', flag: null },
  ];

  const shellHistory = [
    { t: '14:32:07', cmd: 'powershell -nop -w hidden -enc SQBFAFgA...', flag: 'malicious' },
    { t: '14:31:52', cmd: 'vssadmin delete shadows /all /quiet', flag: 'malicious' },
    { t: '14:30:58', cmd: 'reg add HKCU\\...\\Run /v Updater /d C:\\ProgramData\\svc.exe', flag: 'suspicious' },
    { t: '14:27:03', cmd: 'net user helpdesk P@ss-2026 /add', flag: 'suspicious' },
    { t: '14:26:44', cmd: 'whoami /priv', flag: null },
  ];

  const iocs = [
    { type: 'IPv4', value: '185.220.101.34', verdict: 'malicious', score: 92, sources: 14, tags: ['C2', 'Cobalt Strike'], first: '2026-06-28', asn: 'AS205100 F3 Netze' },
    { type: 'Domain', value: 'pay-invoice-verify.top', verdict: 'malicious', score: 88, sources: 9, tags: ['Phishing', 'Newly registered'], first: '2026-06-30', asn: '—' },
    { type: 'SHA-256', value: 'a3f5c9d1…e8b027', verdict: 'malicious', score: 96, sources: 41, tags: ['Ransomware', 'LockBit'], first: '2026-05-11', asn: '—' },
    { type: 'IPv4', value: '203.0.113.9', verdict: 'suspicious', score: 61, sources: 5, tags: ['SSH brute force'], first: '2026-06-29', asn: 'AS64512 Example ISP' },
    { type: 'CVE', value: 'CVE-2026-31200', verdict: 'informational', score: 40, sources: 3, tags: ['Privilege escalation'], first: '2026-06-15', asn: '—' },
  ];

  const osqueryResult = [
    { name: 'svc.exe', path: 'C:\\ProgramData\\svc.exe', pid: 6624, uid: 'svc-batch', on_disk: 1 },
    { name: 'vssadmin.exe', path: 'C:\\Windows\\System32\\vssadmin.exe', pid: 7710, uid: 'svc-batch', on_disk: 1 },
    { name: 'rundll32.exe', path: 'C:\\Windows\\System32\\rundll32.exe', pid: 6710, uid: 'svc-batch', on_disk: 1 },
  ];

  return { alerts, logs, fields, histogram, scenarios, firewallRules, utm, processes, connections, browserHistory, shellHistory, iocs, osqueryResult };
})();

export default AthenaData;
