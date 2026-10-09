#!/usr/bin/env node
// Claude Code PostToolUse hook for the Edit, Write and MultiEdit tools.
//
// Reads the hook payload (JSON) from stdin and formats the edited file with the
// repository's locally installed Prettier. It only touches JS/TS files inside
// the project root and skips generated, build and vendor folders. Prettier also
// honours .prettierignore and .gitignore.
//
// Exit codes: 0 = formatted or intentionally skipped, 1 = setup problem shown to
// the user (non-blocking), 2 = Prettier failed (stderr is fed back to Claude).

import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORTED_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
]);
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  'generated',
  '.prisma',
]);

// Prettier is resolved from the repository that contains this script, never downloaded.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRETTIER_BIN = path.join(REPO_ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function fail(code, message) {
  process.stderr.write(`format-file hook: ${message}\n`);
  process.exit(code);
}

async function main() {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    fail(1, 'could not parse hook input as JSON; file was not formatted.');
  }

  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.trim() === '') process.exit(0);

  const projectRoot = realpathSync(process.env.CLAUDE_PROJECT_DIR || REPO_ROOT);
  const baseDir = typeof payload.cwd === 'string' ? payload.cwd : projectRoot;
  const absolute = path.resolve(baseDir, filePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) process.exit(0);

  // realpath resolves symlinks so a link inside the repo cannot point us outside it.
  const relative = path.relative(projectRoot, realpathSync(absolute));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) process.exit(0);

  if (!SUPPORTED_EXTENSIONS.has(path.extname(relative).toLowerCase())) process.exit(0);
  const segments = relative.split(path.sep).map((s) => s.toLowerCase());
  if (segments.some((s) => SKIPPED_DIRECTORIES.has(s))) process.exit(0);

  if (!existsSync(PRETTIER_BIN)) {
    fail(1, `local Prettier not found at ${PRETTIER_BIN}. Run "npm ci" in the repository root.`);
  }

  // Argument array + shell:false: the path is passed as one literal argument, never interpolated.
  const result = spawnSync(
    process.execPath,
    [PRETTIER_BIN, '--write', '--log-level', 'warn', relative.split(path.sep).join('/')],
    { cwd: projectRoot, encoding: 'utf8', shell: false, timeout: 25_000 },
  );

  if (result.error) fail(1, `could not run Prettier: ${result.error.message}`);
  if (result.status !== 0) {
    fail(2, `Prettier failed for ${relative}:\n${(result.stderr || result.stdout).trim()}`);
  }
  process.exit(0);
}

main().catch((error) => fail(1, `unexpected error: ${error?.message ?? error}`));
