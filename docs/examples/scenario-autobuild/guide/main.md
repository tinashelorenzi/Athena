# Part 1 — Triage the alerts

Open the **Alerts** panel and let the scenario run. Note the order in which the
alerts fire — they tell the story of the intrusion over time.

## Task 1 — The first detection

The first alert is an *Encoded PowerShell command*. Encoded (`-enc`) commands are
a common way to hide intent.

```prompt
question: What is the C2 IP address the host connects out to?
answer: 185.220.101.34
hint: Check the "Outbound connection to known C2" alert and the network connections on win-ep-04.
points: 10
```

# Part 2 — Follow the process tree

Open the **Endpoints** panel and inspect the process tree on `win-ep-04`. Trace
`powershell.exe` back to its parent.

## Task 2 — Initial access

```prompt
question: Which process spawned powershell.exe?
answer: winword.exe
hint: Follow the process tree upward from powershell.exe.
points: 10
```

# Part 3 — Wrap up

Summarize what you found in the **Submit** panel and answer the graded flags.
