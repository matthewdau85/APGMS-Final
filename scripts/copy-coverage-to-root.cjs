// scripts/copy-coverage-to-root.js
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

// Candidate coverage files from packages
const sources = [
  'packages/domain-policy/coverage/coverage-summary.json',
  'packages/ledger/coverage/coverage-summary.json',
  'services/api-gateway/coverage/coverage-summary.json',
];

const rootCoverageDir = path.join(repoRoot, 'coverage');
const targetFile = path.join(rootCoverageDir, 'coverage-summary.json');

for (const rel of sources) {
  const src = path.join(repoRoot, rel);
  if (fs.existsSync(src)) {
    fs.mkdirSync(rootCoverageDir, { recursive: true });
    fs.copyFileSync(src, targetFile);
    console.log(
      `Copied coverage from ${rel} -> coverage/coverage-summary.json`
    );
    process.exit(0);
  }
}

console.warn(
  'No package coverage-summary.json found; nothing copied to coverage/.'
);
process.exit(0);
