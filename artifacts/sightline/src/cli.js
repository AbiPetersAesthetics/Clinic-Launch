#!/usr/bin/env node
/**
 * Sightline CLI.
 *
 * Exits non-zero when the audit finds a critical problem, so it can be dropped
 * into CI as a regression guard: a deploy that accidentally disallows
 * OAI-SearchBot, or flips a template to client-side rendering, fails the build
 * instead of quietly costing six months of AI citations.
 *
 * @module cli
 */

import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { audit } from './io/audit.js';
import { renderReport } from './render/terminal.js';
import { UnsafeUrlError } from './io/fetcher.js';

const USAGE = `
Sightline — find out whether AI assistants can reach, read and cite your site.

  Usage
    sightline <url> [options]

  Options
    --json              Emit the full report as JSON.
    --verbose           Show every finding, not just the priorities.
    --no-probe          Skip live per-crawler HTTP probes (faster, less thorough).
    --write <dir>       Write the generated robots.txt and llms.txt into <dir>.
    --fail-on <level>   Exit non-zero at this severity or worse.
                        critical (default) | high | medium | none
    --help              Show this message.

  Examples
    sightline example.com
    sightline https://example.com/pricing --verbose
    sightline example.com --json > report.json
    sightline example.com --write ./public
`;

/** @type {Record<string, number>} */
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

async function main() {
  // parseArgs has no notion of `--no-x` negation, but `--no-probe` is the
  // spelling people reach for, so handle it before parsing.
  const argv = process.argv.slice(2);
  const skipProbe = argv.includes('--no-probe');

  let parsed;
  try {
    parsed = parseArgs({
      args: argv.filter((a) => a !== '--no-probe'),
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
        write: { type: 'string' },
        'fail-on': { type: 'string', default: 'critical' },
        help: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const { values, positionals } = parsed;
  const target = positionals[0];

  if (values.help || !target) {
    process.stdout.write(USAGE);
    process.exit(target ? 0 : 1);
  }

  const isJson = values.json === true;

  try {
    if (!isJson) {
      process.stderr.write(`  Auditing ${target}…\n`);
    }

    const { report } = await audit(target, {
      probeAgents: !skipProbe,
      onProgress: (stage) => {
        if (!isJson) process.stderr.write(`  ${stage}…\n`);
      },
    });

    if (isJson) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(renderReport(report, { verbose: values.verbose === true }));
    }

    if (typeof values.write === 'string') {
      await writeFile(`${values.write}/robots.txt`, report.remediation.robotsTxt, 'utf8');
      await writeFile(`${values.write}/llms.txt`, report.remediation.llmsTxt, 'utf8');
      if (!isJson) {
        process.stderr.write(`  Wrote robots.txt and llms.txt to ${values.write}\n`);
      }
    }

    process.exit(exitCode(report, String(values['fail-on'])));
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      fail(error.message);
      return;
    }
    fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * @param {import('./core/types.js').AuditReport} report
 * @param {string} failOn
 * @returns {number}
 */
function exitCode(report, failOn) {
  if (failOn === 'none') return 0;
  const threshold = SEVERITY_RANK[failOn] ?? 0;
  const worst = report.findings.reduce(
    (min, f) => Math.min(min, SEVERITY_RANK[f.severity] ?? 4),
    4,
  );
  return worst <= threshold ? 1 : 0;
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  process.stderr.write(`  Error: ${message}\n`);
  process.exit(2);
}

await main();
