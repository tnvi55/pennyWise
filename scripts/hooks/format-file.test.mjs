// Tests for format-file.mjs. Each test builds a throwaway project root in the OS
// temp directory (with a space in its path) and points CLAUDE_PROJECT_DIR at it,
// so the real repository is never modified.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'format-file.mjs');
const UNFORMATTED = 'const   value = {a:1,b:"two"}\n';
const FORMATTED = "const value = { a: 1, b: 'two' };\n";

let tempBase;
let projectRoot;
let outsideRoot;

function runHook(input, root = projectRoot) {
  return spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
}

function payload(filePath, toolName = 'Write') {
  return {
    session_id: 'test',
    cwd: projectRoot,
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: { file_path: filePath },
    tool_response: { filePath, success: true },
  };
}

function writeFixture(relativePath, content) {
  const full = path.join(projectRoot, relativePath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

before(() => {
  tempBase = mkdtempSync(path.join(os.tmpdir(), 'pennywise-hook-test-'));
  projectRoot = path.join(tempBase, 'project with spaces');
  outsideRoot = path.join(tempBase, 'outside');
  mkdirSync(projectRoot);
  mkdirSync(outsideRoot);
  writeFileSync(
    path.join(projectRoot, '.prettierrc.json'),
    JSON.stringify({ singleQuote: true, trailingComma: 'all', printWidth: 100 }),
  );
});

after(() => {
  // Only remove the directory this test file created under the OS temp dir.
  if (tempBase && path.basename(tempBase).startsWith('pennywise-hook-test-')) {
    rmSync(tempBase, { recursive: true, force: true });
  }
});

describe('format-file hook', () => {
  it('formats an unformatted .ts file in a path containing spaces', () => {
    const file = writeFixture('src/my folder/example.ts', UNFORMATTED);
    const result = runHook(payload(file));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(file, 'utf8'), FORMATTED);
  });

  it('resolves a relative file_path against the payload cwd (Edit tool)', () => {
    const file = writeFixture('src/relative.tsx', UNFORMATTED);
    const result = runHook(payload('src/relative.tsx', 'Edit'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(file, 'utf8'), FORMATTED);
  });

  it('leaves unsupported file types untouched', () => {
    const file = writeFixture('notes.md', '#   Title\n\n*  item\n');
    const result = runHook(payload(file));
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, 'utf8'), '#   Title\n\n*  item\n');
  });

  it('skips files inside node_modules, dist and generated folders', () => {
    for (const dir of ['node_modules/pkg', 'dist', 'apps/api/src/generated']) {
      const file = writeFixture(`${dir}/skip.js`, UNFORMATTED);
      const result = runHook(payload(file));
      assert.equal(result.status, 0);
      assert.equal(readFileSync(file, 'utf8'), UNFORMATTED, dir);
    }
  });

  it('leaves files outside the project root untouched', () => {
    const file = path.join(outsideRoot, 'outside.ts');
    writeFileSync(file, UNFORMATTED);
    const result = runHook(payload(file));
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, 'utf8'), UNFORMATTED);
  });

  it('exits 0 for a path that does not exist', () => {
    const result = runHook(payload(path.join(projectRoot, 'missing.ts')));
    assert.equal(result.status, 0);
  });

  it('exits 0 when file_path is absent', () => {
    const result = runHook({ hook_event_name: 'PostToolUse', tool_input: {} });
    assert.equal(result.status, 0);
  });

  it('reports malformed JSON visibly (exit 1)', () => {
    const result = runHook('{not json');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /could not parse/);
  });

  it('reports a Prettier syntax error back to Claude (exit 2)', () => {
    const file = writeFixture('src/broken.ts', 'const = ;\n');
    const result = runHook(payload(file));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Prettier failed/);
  });
});
