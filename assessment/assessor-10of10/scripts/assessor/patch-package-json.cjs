"use strict";

const fs = require("node:fs");

function main() {
  const pj = JSON.parse(fs.readFileSync("package.json", "utf8"));
  pj.scripts = pj.scripts || {};

  // Keep existing scripts. Add assessor scripts.
  pj.scripts["assess:fast"] = "node scripts/apgms-assess.cjs --fast";
  pj.scripts["assess:full"] = "node scripts/apgms-assess.cjs --full";
  pj.scripts["assess:all"] = "node scripts/apgms-assess.cjs --all";
  pj.scripts["assess:prototype"] = "node scripts/apgms-assess.cjs --all --prototype";
  pj.scripts["assess:production"] = "node scripts/apgms-assess.cjs --all --production";

  fs.writeFileSync("package.json", JSON.stringify(pj, null, 2) + "\n", "utf8");
  console.log("Patched package.json scripts: assess:*");
}

main();
