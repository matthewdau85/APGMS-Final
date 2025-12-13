"use strict";

/*
  Backup/restore drill scaffold (local/CI)

  This script is intentionally conservative:
  - It checks tool availability (docker, pg_dump, psql)
  - If unavailable, it exits with SKIP (code 3) unless STRICT=1

  For CI, ensure tools are available and run with STRICT=1.
*/

const cp = require("node:child_process");

function which(cmd) {
  const r = cp.spawnSync(cmd, ["--version"], { shell: true, encoding: "utf8" });
  return r.status === 0;
}

function main() {
  const strict = process.env.STRICT === "1";
  const haveDocker = which("docker");
  const havePgDump = which("pg_dump");
  const havePsql = which("psql");

  if (!haveDocker || !havePgDump || !havePsql) {
    const msg = `[restore-drill] SKIP: missing tools: docker=${haveDocker} pg_dump=${havePgDump} psql=${havePsql}`;
    console.log(msg);
    process.exit(strict ? 2 : 3);
  }

  console.log("[restore-drill] TODO: implement restore drill steps for your DB/compose configuration.");
  console.log("[restore-drill] Minimum steps: bring up db -> create test schema -> dump -> drop -> restore -> run migrations -> smoke tests.");
  process.exit(0);
}

main();
