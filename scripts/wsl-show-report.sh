#!/usr/bin/env bash
# Extract the per-round summary (name, succ, fail, throughput, latency) from the
# Caliper HTML report.
REPORT="${1:-$HOME/safechain/caliper/report-quick.html}"
python3 - "$REPORT" <<'PY'
import sys, re, html
data = open(sys.argv[1], encoding='utf-8').read()
# Caliper embeds a summary table; rows contain <td>cell</td>
rows = re.findall(r'<tr>(.*?)</tr>', data, re.S)
for r in rows:
    cells = [html.unescape(re.sub('<.*?>','',c)).strip() for c in re.findall(r'<td.*?>(.*?)</td>', r, re.S)]
    if cells and len(cells) >= 7:
        print(' | '.join(cells[:8]))
PY
