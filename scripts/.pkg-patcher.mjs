import fs from 'fs';
import path from 'path';

const root = process.cwd();

function readJson(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); console.log(`[patched] ${path.relative(root, p)}`); }
function ensureBucket(pkg, key){ if (!pkg[key] || typeof pkg[key] !== 'object') pkg[key] = {}; return pkg[key]; }

function addDeps(pkgPath, depMap, dev=false){
  const pkg = readJson(pkgPath); if (!pkg) return;
  const bucket = ensureBucket(pkg, dev ? 'devDependencies' : 'dependencies');
  let changed = false;
  for (const [k,v] of Object.entries(depMap)){ if (!bucket[k]) { bucket[k] = v; changed = true; } }
  if (changed) writeJson(pkgPath, pkg);
}

function setScript(pkgPath, scriptName, value){
  const pkg = readJson(pkgPath); if (!pkg) return;
  if (!pkg.scripts) pkg.scripts = {};
  if (pkg.scripts[scriptName] !== value) { pkg.scripts[scriptName] = value; writeJson(pkgPath, pkg); }
}

function ensureTsTypes(tsconfigPath, types){
  const ts = readJson(tsconfigPath); if (!ts) return;
  if (!ts.compilerOptions) ts.compilerOptions = {};
  const cur = new Set(Array.isArray(ts.compilerOptions.types) ? ts.compilerOptions.types : []);
  let changed = false;
  for (const t of types){ if (!cur.has(t)) { cur.add(t); changed = true; } }
  if (changed) { ts.compilerOptions.types = Array.from(cur); writeJson(tsconfigPath, ts); }
}

// shared: runtime argon2; dev types; prisma prebuild; TS types
{
  const sharedPkg = path.join(root, 'shared', 'package.json');
  if (fs.existsSync(sharedPkg)) {
    addDeps(sharedPkg, { 'argon2': '^0.41.1' }, false);
    addDeps(sharedPkg, { '@types/node': '^24.10.1', '@types/jest': '^29.5.14' }, true);
    setScript(sharedPkg, 'prebuild', 'prisma generate --schema=../infra/prisma/schema.prisma');
  }
  const sharedTs = path.join(root, 'shared', 'tsconfig.json');
  if (fs.existsSync(sharedTs)) ensureTsTypes(sharedTs, ['node','jest']);
}

// api-gateway: declare fastify runtime
{
  const apiPkg = path.join(root, 'services', 'api-gateway', 'package.json');
  if (fs.existsSync(apiPkg)) addDeps(apiPkg, { 'fastify': '^5.6.1' }, false);
}

// regwatcher: js-yaml for YAML parsing (if present)
{
  const regPkg = path.join(root, 'packages', 'regwatcher', 'package.json');
  if (fs.existsSync(regPkg)) addDeps(regPkg, { 'js-yaml': '^4.1.0' }, false);
}
