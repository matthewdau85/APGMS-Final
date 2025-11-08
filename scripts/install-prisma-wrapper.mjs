#!/usr/bin/env node
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(rootDir, "..");
const wrapperPath = join(rootDir, "prisma-wrapper.mjs");

const binDirs = new Set();

function collectBinDirs(dir, depth) {
  if (depth > 3) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" && entry.isDirectory()) {
      const bin = join(dir, entry.name, ".bin");
      if (fs.existsSync(bin)) {
        binDirs.add(bin);
      }
      continue;
    }

    if (entry.isDirectory()) {
      collectBinDirs(join(dir, entry.name), depth + 1);
    }
  }
}

collectBinDirs(repoRoot, 0);

for (const binDir of binDirs) {
  const prismaBin = join(binDir, "prisma");
  const prismaRealBin = join(binDir, "prisma-real");

  try {
    if (fs.existsSync(prismaRealBin)) {
      fs.unlinkSync(prismaRealBin);
    }
  } catch {}

  try {
    if (fs.existsSync(prismaBin)) {
      const stat = fs.lstatSync(prismaBin);
      if (stat.isSymbolicLink() || stat.isFile()) {
        fs.renameSync(prismaBin, prismaRealBin);
      }
    }
  } catch (error) {
    console.warn(`Unable to move existing Prisma binary in ${binDir}:`, error);
  }

  try {
    if (fs.existsSync(prismaBin)) {
      fs.unlinkSync(prismaBin);
    }
    fs.symlinkSync(wrapperPath, prismaBin);
  } catch (error) {
    console.warn(`Unable to install Prisma wrapper in ${binDir}:`, error);
  }
}
