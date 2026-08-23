/**
 * Auto-compact .opencode/memory/*.json so workflow prompts never exceed the
 * OS ARG_MAX (~128KB). Runs BEFORE memories are injected into env/prompt.
 *
 * Rules:
 *  - Any string longer than MAX_STR is truncated (… marker)
 *  - session_notes: keep last 3, lessons capped
 *  - known_issues: keep last 12, reduced to {id,title,status}
 *  - known_limitations / preferred_patterns: keep last N, capped length
 *  - Global budget per file: if still over, drop oldest list items until fit
 *
 * Run: node scripts/compact-memories.mjs  (idempotent, exit 0 always)
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const MEM_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.opencode', 'memory');

const MAX_STR = 300;
const TOTAL_BUDGET = {
  'shared.json': 6000,
  'default': 4500,
};
const LIMITS = {
  session_notes: { keep: 3, lessonCap: 500 },
  known_issues: { keep: 12 },
  known_limitations: { keep: 8 },
  preferred_patterns: { keep: 6 },
  recent_failures: { keep: 5 },
  cross_agent_constraints: { keep: 10 },
};

const walkStrings = (node, fn) => {
  if (typeof node === 'string') fn(node);
  else if (Array.isArray(node)) node.forEach(n => walkStrings(n, fn));
  else if (node && typeof node === 'object') Object.values(node).forEach(n => walkStrings(n, fn));
};

const truncate = s => (s.length > MAX_STR ? s.slice(0, MAX_STR - 1) + '…' : s);

function compactFile(file) {
  const path = resolve(MEM_DIR, file);
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch { return console.log('· skip', file); }

  // 1) Cap every string in the document
  walkStrings(data, () => {});
  const capNode = node => {
    if (typeof node === 'string') return truncate(node);
    if (Array.isArray(node)) return node.map(capNode);
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) node[k] = capNode(node[k]);
      return node;
    }
    return node;
  };
  capNode(data);

  // 2) List-specific trims
  for (const [key, { keep }] of Object.entries(LIMITS)) {
    if (Array.isArray(data[key]) && data[key].length > keep) data[key] = data[key].slice(-keep);
  }
  if (Array.isArray(data.session_notes)) {
    data.session_notes = data.session_notes.slice(-LIMITS.session_notes.keep)
      .map(n => ({ ...n, lesson: String(n.lesson ?? '').slice(0, LIMITS.session_notes.lessonCap) }));
  }
  if (Array.isArray(data.known_issues)) {
    data.known_issues = data.known_issues.slice(-LIMITS.known_issues.keep)
      .map(k => ({ id: k.id, title: k.title, status: k.status }));
  }

  // 3) Global budget: drop heaviest list items until under budget
  const budget = TOTAL_BUDGET[file] ?? TOTAL_BUDGET.default;
  let out = JSON.stringify(data);
  const listKeys = ['session_notes', 'known_issues', ...Object.keys(LIMITS).filter(k => k !== 'session_notes' && k !== 'known_issues')];
  let guard = 50;
  while (out.length > budget && guard-- > 0) {
    let dropped = false;
    for (const key of listKeys) {
      if (Array.isArray(data[key]) && data[key].length > 1) {
        data[key] = data[key].slice(1); // drop oldest
        dropped = true;
        break;
      }
    }
    if (!dropped) break;
    out = JSON.stringify(data);
  }

  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`✓ ${file}: ${out.length} chars`);
}

for (const f of readdirSync(MEM_DIR)) {
  if (f.endsWith('.json')) compactFile(f);
}
