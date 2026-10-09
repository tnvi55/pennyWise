#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash and PowerShell tools.
//
// Reads the hook payload (JSON) from stdin and denies recognizable destructive
// commands: force pushes, hard resets, broad recursive deletes, database
// resets/drops and Docker volume deletion. Anything else gets no decision, so
// Claude Code's normal permission rules and prompts still apply.
//
// This is an extra safeguard, not a security boundary: pattern matching can be
// bypassed by obfuscation. Keep Claude Code permissions enabled.
//
// The command text is only inspected as a string; it is never executed here.

import { pathToFileURL } from 'node:url';

const SEGMENT_SEPARATOR = /\s*(?:&&|\|\||[;|&\n\r])\s*/;

const DELETE_COMMANDS = new Set(['rm', 'rmdir', 'rd', 'del', 'erase', 'ri', 'remove-item']);

/** Targets whose recursive deletion would wipe a root, home or the whole project. */
function isBroadTarget(rawTarget) {
  const target = rawTarget.replace(/[\\/]+$/, '') || rawTarget.slice(0, 1);
  return (
    ['/', '\\', '~', '.', '..', '*', '/*', './*', '.\\*', '~/*', '$home', '%userprofile%'].includes(
      target,
    ) ||
    target.startsWith('$env:userprofile') ||
    target.startsWith('$home') ||
    /^[a-z]:\\?\*?$/.test(target) || // C:  C:\  C:*
    /^[a-z]:[\\/]\*$/.test(target) || // C:\*  C:/*
    /^\/[a-z]$/.test(target) || // Git Bash drive path such as /c
    /^(\.\.[\\/]?)+\*?$/.test(target) // ../..  ../*
  );
}

function stripQuotes(token) {
  return token.replace(/^["'`]+|["'`,]+$/g, '');
}

/** Each rule receives a lowercase segment and its tokens and returns a reason or null. */
const RULES = [
  (seg, tokens) => {
    if (!/\bgit\b.*\bpush\b/.test(seg)) return null;
    const forced = tokens.some(
      (t) =>
        t === '--force' ||
        t.startsWith('--force-with-lease') ||
        t === '--mirror' ||
        /^-[a-z]*f[a-z]*$/.test(t) ||
        /^\+[^\s]+/.test(t),
    );
    return forced ? 'Force push rewrites remote history.' : null;
  },
  (seg) => (/\bgit\b.*\breset\b.*--hard\b/.test(seg) ? 'git reset --hard discards work.' : null),
  (seg, tokens) =>
    /\bgit\b.*\bclean\b/.test(seg) && tokens.some((t) => t === '--force' || /^-[a-z]*f/.test(t))
      ? 'git clean -f permanently deletes untracked files.'
      : null,
  (seg, tokens) => {
    const broad = tokens.some((t) => ['.', '*', ':/', ':/*'].includes(t));
    if (/\bgit\b.*\bcheckout\b/.test(seg) && broad) return 'git checkout . discards local changes.';
    if (/\bgit\b.*\brestore\b/.test(seg) && broad) {
      const onlyStaged = tokens.includes('--staged') && !tokens.includes('--worktree');
      return onlyStaged ? null : 'git restore . discards local changes.';
    }
    return null;
  },
  (_seg, tokens) => {
    const start = tokens.findIndex((t) => DELETE_COMMANDS.has(t));
    if (start === -1) return null;
    const args = tokens.slice(start + 1);
    if (args.some((t) => t === '/s')) return 'cmd-style recursive delete (/s) is blocked.';
    // Unix flag clusters such as -r, -rf, -Rfv, or PowerShell -Recurse (and its -rec abbreviations).
    // -Force must not count as recursive.
    const recursive = args.some(
      (t) => t === '--recursive' || /^-[fivd]*r[fivrd]*$/.test(t) || t.startsWith('-rec'),
    );
    if (!recursive) return null;
    const targets = args.filter((t) => !t.startsWith('-') || t === '-');
    return targets.some(isBroadTarget)
      ? 'Recursive delete of a root, home or whole-project path.'
      : null;
  },
  (seg) =>
    /\bformat-volume\b/.test(seg) || /^format\s+[a-z]:/.test(seg)
      ? 'Formatting a volume is blocked.'
      : null,
  (seg) =>
    /\bprisma\b.*\bmigrate\s+reset\b/.test(seg) ? 'prisma migrate reset drops the database.' : null,
  (seg) =>
    /\bprisma\b.*\bdb\s+push\b/.test(seg) && /--force-reset|--accept-data-loss/.test(seg)
      ? 'prisma db push with data loss flags is blocked; use migrations.'
      : null,
  (seg) =>
    /\bdrop\s+(database|schema|table)\b/.test(seg) || /(^|\s)dropdb\b/.test(seg)
      ? 'SQL DROP is blocked.'
      : null,
  (seg) => (/\btruncate\s+(table\s+)?["\w]/.test(seg) ? 'SQL TRUNCATE is blocked.' : null),
  (seg, tokens) =>
    /\bdocker(-compose)?\b/.test(seg) &&
    /\bdown\b/.test(seg) &&
    tokens.some((t) => t === '--volumes' || /^-[a-z]*v[a-z]*$/.test(t))
      ? 'docker compose down -v deletes database volumes.'
      : null,
  (seg) =>
    /\bdocker\b.*\bvolume\s+(rm|remove|prune)\b/.test(seg)
      ? 'Deleting Docker volumes is blocked.'
      : null,
  (seg) =>
    /\bdocker\b.*\bsystem\s+prune\b/.test(seg) && /--volumes/.test(seg)
      ? 'docker system prune --volumes deletes volumes.'
      : null,
];

/**
 * Pure decision function, exported for tests.
 * @param {string} command
 * @returns {{ decision: 'deny', reason: string } | { decision: 'none' }}
 */
export function evaluateCommand(command) {
  const segments = command.toLowerCase().split(SEGMENT_SEPARATOR).filter(Boolean);
  for (const segment of segments) {
    const tokens = segment.split(/\s+/).map(stripQuotes).filter(Boolean);
    for (const rule of RULES) {
      const reason = rule(segment, tokens);
      if (reason) return { decision: 'deny', reason };
    }
  }
  return { decision: 'none' };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function blockForSafety(message) {
  process.stderr.write(`guard-shell hook: ${message} Blocking the command for safety.\n`);
  process.exit(2);
}

async function main() {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    blockForSafety('could not parse hook input as JSON.');
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string') {
    blockForSafety('hook input has no tool_input.command string.');
  }

  const result = evaluateCommand(command);
  if (result.decision === 'deny') {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked by project guard-shell hook: ${result.reason} Ask the user to run it manually if it is really intended.`,
      },
    };
    process.stdout.write(JSON.stringify(output));
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => blockForSafety(`unexpected error: ${error?.message ?? error}.`));
}
