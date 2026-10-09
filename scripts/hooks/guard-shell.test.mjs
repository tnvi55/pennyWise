// Tests for guard-shell.mjs. Every "dangerous" command below is only a string
// passed to the hook; nothing is executed.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateCommand } from './guard-shell.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard-shell.mjs');

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    shell: false,
  });
}

function payload(toolName, command) {
  return {
    session_id: 'test',
    cwd: process.cwd(),
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: { command, description: 'synthetic test payload' },
  };
}

const SAFE = [
  'git status',
  'git log --oneline -5',
  'git push origin chore/phase-0-setup',
  'git push -u origin main',
  'git restore --staged .',
  'git checkout -b feature/backend-setup',
  'npm test',
  'npm run format:check',
  'Get-ChildItem -Path C:\\Users',
  'rm file.txt',
  'rm -rf dist',
  'Remove-Item -Recurse -Force .\\dist',
  'Remove-Item -Force .\\notes.txt',
  'docker compose up -d',
  'docker compose down',
  'docker compose logs postgres',
  'npx prisma migrate dev --name init',
  'npx prisma migrate deploy',
  'psql -c "SELECT * FROM \\"Transaction\\" LIMIT 5"',
];

const DANGEROUS = [
  'git push --force',
  'git push -f origin main',
  'git push origin main --force-with-lease',
  'git push origin +main',
  'git reset --hard HEAD~1',
  'git clean -fd',
  'git checkout -- .',
  'git restore .',
  'rm -rf /',
  'rm -rf ~',
  'rm -rf .',
  'rm -Rf ../..',
  'rm -r *',
  'sudo rm -rf /*',
  'rm -rf /c',
  'Remove-Item -Recurse -Force C:\\',
  'Remove-Item -Recurse -Force $HOME',
  'Remove-Item -Path . -Recurse',
  'ri -rec -fo *',
  'rd /s /q build',
  'rmdir /s C:\\temp',
  'del /s /q *.*',
  'Format-Volume -DriveLetter D',
  'npx prisma migrate reset --force',
  'npx prisma db push --force-reset',
  'npx prisma db push --accept-data-loss',
  'psql -c "DROP DATABASE pennywise_dev"',
  'psql -c "drop table categories"',
  'psql -c "TRUNCATE TABLE transactions"',
  'dropdb pennywise_dev',
  'docker compose down -v',
  'docker compose down --volumes',
  'docker-compose down -v',
  'docker volume rm pennywise_pgdata',
  'docker volume prune -f',
  'docker system prune -a --volumes',
  'npm test && git push --force',
  'echo ok; rm -rf ~',
];

describe('evaluateCommand', () => {
  for (const command of SAFE) {
    it(`allows (no decision): ${command}`, () => {
      assert.deepEqual(evaluateCommand(command), { decision: 'none' });
    });
  }
  for (const command of DANGEROUS) {
    it(`denies: ${command}`, () => {
      assert.equal(evaluateCommand(command).decision, 'deny');
    });
  }
});

describe('guard-shell hook process', () => {
  for (const tool of ['Bash', 'PowerShell']) {
    it(`${tool}: safe command exits 0 with no output`, () => {
      const result = runHook(payload(tool, 'git status'));
      assert.equal(result.status, 0);
      assert.equal(result.stdout, '');
    });

    it(`${tool}: dangerous command returns a deny decision`, () => {
      const result = runHook(payload(tool, 'git reset --hard'));
      assert.equal(result.status, 0);
      const output = JSON.parse(result.stdout);
      assert.equal(output.hookSpecificOutput.hookEventName, 'PreToolUse');
      assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
      assert.match(output.hookSpecificOutput.permissionDecisionReason, /reset --hard/);
    });
  }

  it('fails closed on malformed JSON (exit 2)', () => {
    const result = runHook('{not json');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /could not parse/);
  });

  it('fails closed on empty input (exit 2)', () => {
    assert.equal(runHook('').status, 2);
  });

  it('fails closed when tool_input.command is missing (exit 2)', () => {
    const result = runHook({ tool_name: 'Bash', tool_input: {} });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /tool_input\.command/);
  });
});
