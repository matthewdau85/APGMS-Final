# scripts/reword_callback.py
# Used by: git filter-repo --commit-callback 'exec(open("scripts/reword_callback.py","r",encoding="utf-8").read())'
import json, os

if 'REWORD_MAP' not in globals():
    with open(os.environ['REWORD_MAP_PATH'], 'r', encoding='utf-8') as f:
        REWORD_MAP = json.load(f)  # { full_hash_lower: "New Subject" }

def reword_commit(commit):
    h = commit.original_id.decode('ascii').lower()
    newsubj = REWORD_MAP.get(h)
    if not newsubj:
        return
    msg = commit.message.decode('utf-8', 'replace')
    lines = msg.splitlines()
    body = '\n'.join(lines[1:]).lstrip('\n')
    # Keep body (if any), replace subject only
    commit.message = (newsubj + ("\n\n" + body if body else "")).encode('utf-8')

reword_commit(commit)
