#!/usr/bin/env node
import { config as dotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv({ path: path.join(process.cwd(), '.env.local') });

import { runOnce } from '../index.mjs';
import { sendEmail } from '../mailer.mjs';

const args = new Set(process.argv.slice(2));
const wantEmail = args.has('--email');
const always = args.has('--always');
const json = args.has('--json');

const results = await runOnce({ json });

const changed = results.filter(r => r.changed);
if (wantEmail && (always || changed.length)) {
  const lines = results.map(r => {
    if (r.error) return `✗ ${r.name}  ERROR: ${r.error}`;
    return `${r.changed ? '•' : '–'} ${r.name}  ${r.changed ? 'CHANGED' : 'no change'}  ${r.url}`;
  });
  await sendEmail({
    subject: `[RegWatcher] ${changed.length} changes`,
    text: lines.join('\n')
  });
  console.log(`[email] sent (${changed.length} changes)`);
} else {
  console.log(`[email] skipped (changes: ${changed.length})`);
}
