"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseOsfMatrix(osfPath, statusOrder) {
  try {
    if (!fs.existsSync(osfPath)) {
      return { ok: false, error: "OSF matrix not found at " + osfPath };
    }
    const md = fs.readFileSync(osfPath, "utf8");
    const lines = md.split(/\r?\n/);

    const rows = [];
    const counts = {};
    for (const s of statusOrder) counts[s] = 0;

    for (const line of lines) {
      if (!line.includes("|")) continue;

      const cols = line.split("|").map(x => x.trim()).filter(Boolean);
      if (cols.length < 3) continue;

      const status = cols[cols.length - 1];
      if (statusOrder.includes(status)) {
        counts[status] = (counts[status] || 0) + 1;
        rows.push({ status, raw: line });
      }
    }

    return { ok: true, counts, rows };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function extractEvidenceLinksFromMarkdown(mdText) {
  // Extract markdown links: [text](href)
  const links = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(mdText)) !== null) {
    links.push({ text: m[1], href: m[2] });
  }
  return links;
}

module.exports = { parseOsfMatrix, extractEvidenceLinksFromMarkdown };
