#!/usr/bin/env node
/**
 * Dependency-direction guard (no dependencies needed):
 *   - every import between src/ layers must follow the allowed map below
 *   - there must be no circular imports
 *
 *   node scripts/check-architecture.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/** layer -> layers it may import from (itself is always allowed). */
const ALLOWED = {
  // constants may reference model *types* (e.g. DEFAULT_SETTINGS: Settings); models depend on nothing.
  constants: ['models'],
  models: [],
  helpers: ['constants', 'models'],
  domain: ['constants', 'models', 'helpers'],
  services: ['constants', 'models', 'helpers', 'domain'],
  data: ['constants', 'models', 'helpers', 'domain'],
  viewmodels: ['constants', 'models', 'helpers', 'domain', 'services', 'data'],
  components: ['constants', 'models', 'helpers'],
  screens: ['constants', 'models', 'helpers', 'viewmodels', 'components'],
  styles: [],
  root: ['constants', 'models', 'helpers', 'domain', 'services', 'data', 'viewmodels', 'components', 'screens', 'styles'],
};

/** Packages a layer must never import. */
const FORBIDDEN_PACKAGES = {
  domain: ['react', 'react-dom', '@supabase/supabase-js', 'tesseract.js', 'xlsx'],
  models: ['react', 'react-dom', '@supabase/supabase-js', 'tesseract.js', 'xlsx'],
  helpers: ['react', 'react-dom', '@supabase/supabase-js', 'tesseract.js', 'xlsx'],
  constants: ['react', 'react-dom', '@supabase/supabase-js', 'tesseract.js', 'xlsx'],
  viewmodels: ['@supabase/supabase-js', 'tesseract.js', 'xlsx'],
  screens: ['@supabase/supabase-js', 'tesseract.js', 'xlsx'],
  components: ['@supabase/supabase-js', 'tesseract.js', 'xlsx'],
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function layerOf(file) {
  const rel = relative(SRC, file).split(sep);
  return rel.length === 1 ? 'root' : rel[0];
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? base;
}

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const files = walk(SRC);
const graph = new Map();
const errors = [];

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  const layer = layerOf(file);
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    const target = resolveImport(file, spec);
    if (!target) {
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if ((FORBIDDEN_PACKAGES[layer] ?? []).includes(pkg)) {
        errors.push(`${relative(ROOT, file)}: layer "${layer}" must not import package "${pkg}"`);
      }
      continue;
    }
    if (!target.startsWith(SRC)) continue;
    const targetLayer = layerOf(target);
    if (targetLayer !== layer && !(ALLOWED[layer] ?? []).includes(targetLayer)) {
      errors.push(`${relative(ROOT, file)}: "${layer}" -> "${targetLayer}" is not allowed (${spec})`);
    }
    if (!/\.css$/.test(target)) deps.push(target);
  }
  graph.set(file, deps);
}

// Cycle detection (DFS with colouring)
const state = new Map();
const stack = [];
function visit(node) {
  state.set(node, 'visiting');
  stack.push(node);
  for (const dep of graph.get(node) ?? []) {
    if (!graph.has(dep)) continue;
    if (state.get(dep) === 'visiting') {
      const cycle = stack.slice(stack.indexOf(dep)).concat(dep).map((f) => relative(ROOT, f));
      errors.push(`circular import: ${cycle.join(' -> ')}`);
    } else if (!state.has(dep)) visit(dep);
  }
  stack.pop();
  state.set(node, 'done');
}
for (const file of graph.keys()) if (!state.has(file)) visit(file);

if (errors.length) {
  console.error(`Architecture check failed (${errors.length}):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Architecture check passed: ${files.length} files, layer rules respected, no circular imports.`);
