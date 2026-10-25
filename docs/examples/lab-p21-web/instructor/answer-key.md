# Practical 21 — answer key (instructors only; not uploaded)

Reference values used for `reference/good.evidence.json`: token `K7Q2XM`, SID base `1230000`.

## nginx — `/etc/nginx/conf.d/hardening.conf`

```nginx
server_tokens off;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-Vukani-Node K7Q2XM always;
```

`conf.d/*.conf` is included inside `http {}`, and the stock default site sets no
`add_header` of its own, so the headers apply to every response.

## Snort — append to `/etc/snort/rules/local.rules`

```
alert tcp any any -> any 80 (msg:"ZAIO-K7Q2XM SQL injection on /track"; flow:to_server,established; content:"/track"; content:"UNION"; nocase; content:"SELECT"; nocase; distance:0; classtype:web-application-attack; sid:1230001; rev:1;)
```

## How the reference evidence was made

On Ubuntu 24.04 (nginx 1.24.0, Snort 2.9.20 from the Ubuntu archive):

1. `lab/assets/sqli.pcap` — one benign and one SQL-injection request to
   `http://127.0.0.1/track?id=…`, captured with tcpdump and converted to an
   Ethernet link layer (Snort 2 can't read Linux "cooked" captures).
2. Baseline hashes taken on the stock config, then `broken.evidence.json`
   collected with nothing changed.
3. The answer key above applied, then `good.evidence.json` collected.

Check the folder with `npm run lab:check -- docs/examples/lab-p21-web`.
