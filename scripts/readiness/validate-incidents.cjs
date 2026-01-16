#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const INCIDENTS_DIR = path.join(ROOT, "incidents");

function println(s = "") {
  process.stdout.write(String(s) + "\n");
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listIncidentJson(dir) {
  const out = [];
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    if (!e.isFile()) continue;
    if (!e.name.toLowerCase().endsWith(".json")) continue;
    out.push(path.join(dir, e.name));
  }
  return out.sort();
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function main() {
  if (!isDir(INCIDENTS_DIR)) {
    println(`[incident-validate] incidents/ folder missing: ${INCIDENTS_DIR}`);
    return 1;
  }

  const files = listIncidentJson(INCIDENTS_DIR);

  if (files.length === 0) {
    println("[incident-validate] No incident JSON files found. OK (nothing to validate yet).");
    return 0;
  }

  const required = ["id", "createdAt", "title", "severity", "summary", "status"];

  let bad = 0;

  for (const f of files) {
    let obj;
    try {
      obj = readJson(f);
    } catch (e) {
      println(`[incident-validate] INVALID JSON: ${f} (${String(e)})`);
      bad++;
      continue;
    }

    const missing = required.filter((k) => !(k in obj));
    if (missing.length > 0) {
      println(`[incident-validate] Missing keys in ${path.basename(f)}: ${missing.join(", ")}`);
      bad++;
    }
  }

  if (bad > 0) {
    println(`[incident-validate] FAIL: ${bad} incident file(s) invalid.`);
    return 2;
  }

  println(`[incident-validate] OK: ${files.length} incident file(s) validated.`);
  return 0;
}

process.exit(main());
