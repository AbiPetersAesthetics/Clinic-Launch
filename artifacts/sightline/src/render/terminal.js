/**
 * Terminal rendering.
 *
 * Kept apart from the CLI entry point so the same renderer can be reused by
 * CI integrations and scheduled monitors without dragging in argument parsing.
 *
 * @module render/terminal
 */

import { PILLAR_LABELS, PILLAR_QUESTIONS, priorityFindings } from '../core/scoring.js';
import { postureLabel } from '../core/posture.js';

/** @typedef {import('../core/types.js').AuditReport} AuditReport */
/** @typedef {import('../core/types.js').Finding} Finding */
/** @typedef {import('../core/types.js').Severity} Severity */

const useColour = process.stdout.isTTY && process.env['NO_COLOR'] === undefined;

/**
 * @param {string} code
 * @returns {(text: string) => string}
 */
const style = (code) => (text) => (useColour ? `[${code}m${text}[0m` : text);

const bold = style('1');
const dim = style('2');
const red = style('31');
const green = style('32');
const yellow = style('33');
const blue = style('34');
const magenta = style('35');
const cyan = style('36');

/** @type {Record<Severity, (t: string) => string>} */
const SEVERITY_COLOUR = {
  critical: red,
  high: yellow,
  medium: cyan,
  low: blue,
  info: dim,
};

/** @type {Record<Severity, string>} */
const SEVERITY_LABEL = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'OK',
};

/**
 * Render a full report as text.
 *
 * @param {AuditReport} report
 * @param {{ verbose?: boolean }} [options]
 * @returns {string}
 */
export function renderReport(report, options = {}) {
  const { verbose = false } = options;
  /** @type {string[]} */
  const out = [];

  out.push('');
  out.push(bold(`  Sightline — AI reach audit`));
  out.push(dim(`  ${report.pageUrl}`));
  out.push('');
  out.push(renderScoreBlock(report));
  out.push('');
  out.push(renderPostureBlock(report));
  out.push('');
  out.push(renderPillars(report));
  out.push('');
  out.push(renderCrawlerTable(report));
  out.push('');

  const priorities = priorityFindings(report.findings, verbose ? 100 : 6);
  if (priorities.length > 0) {
    out.push(bold('  What to fix, in order of consequence'));
    out.push('');
    priorities.forEach((finding, index) => {
      out.push(renderFinding(finding, index + 1));
    });
  }

  out.push(bold('  Action plan'));
  out.push('');
  report.remediation.steps.forEach((step, index) => {
    out.push(`  ${dim(`${index + 1}.`)} ${wrap(step, 74, '     ')}`);
  });
  out.push('');
  out.push(
    dim(
      `  Engine ${report.meta.engineVersion} · ${report.findings.length} findings · ${report.meta.durationMs}ms`,
    ),
  );
  out.push('');

  return out.join('\n');
}

/**
 * @param {AuditReport} report
 * @returns {string}
 */
function renderScoreBlock(report) {
  const colour = report.score >= 80 ? green : report.score >= 55 ? yellow : red;
  const bar = renderBar(report.score, 40);
  return [
    `  ${colour(bold(String(report.score).padStart(3)))} ${dim('/100')}   ${colour(bar)}  ${colour(bold(report.grade))}`,
  ].join('\n');
}

/**
 * @param {AuditReport} report
 * @returns {string}
 */
function renderPostureBlock(report) {
  const coherent = report.posture === 'citation-only' || report.posture === 'open' || report.posture === 'closed';
  const colour = coherent ? green : report.posture === 'training-only' ? red : yellow;
  return [
    `  ${dim('Posture')}  ${colour(bold(postureLabel(report.posture)))}`,
    '',
    wrap(report.postureSummary, 74, '  '),
  ].join('\n');
}

/**
 * @param {AuditReport} report
 * @returns {string}
 */
function renderPillars(report) {
  /** @type {string[]} */
  const lines = [bold('  Pillars'), ''];
  for (const pillar of report.pillars) {
    const colour = pillar.score >= 80 ? green : pillar.score >= 55 ? yellow : red;
    lines.push(
      `  ${PILLAR_LABELS[pillar.pillar].padEnd(15)} ${colour(String(pillar.score).padStart(3))} ${colour(renderBar(pillar.score, 24))}  ${dim(PILLAR_QUESTIONS[pillar.pillar])}`,
    );
  }
  return lines.join('\n');
}

/**
 * The crawler table is the heart of the terminal output: it makes the
 * training/answer-engine split visible at a glance, which is the whole point.
 *
 * @param {AuditReport} report
 * @returns {string}
 */
function renderCrawlerTable(report) {
  /** @type {string[]} */
  const lines = [];

  const answerEngines = report.agents.filter((a) => a.agent.reachWeight > 0);
  const training = report.agents.filter((a) => a.agent.purpose === 'training');

  lines.push(bold('  Answer engines') + dim('  — blocking these costs you visibility'));
  lines.push('');
  for (const verdict of [...answerEngines].sort((a, b) => b.agent.reachWeight - a.agent.reachWeight)) {
    const mark = verdict.allowed ? green('  allowed ') : red('  BLOCKED ');
    const via = verdict.blockedBy === 'http' ? red(' (server, not robots.txt)') : '';
    lines.push(
      `${mark} ${verdict.agent.token.padEnd(20)} ${dim(verdict.agent.product)}${via}`,
    );
  }

  lines.push('');
  lines.push(bold('  Training crawlers') + dim('  — blocking these is free'));
  lines.push('');
  const blockedTraining = training.filter((t) => !t.allowed).length;
  lines.push(
    `  ${blockedTraining === training.length ? green('all opted out') : `${magenta(String(blockedTraining))}${dim(` of ${training.length} opted out`)}`}  ${dim(training.map((t) => t.agent.token).join(', '))}`,
  );

  return lines.join('\n');
}

/**
 * @param {Finding} finding
 * @param {number} index
 * @returns {string}
 */
function renderFinding(finding, index) {
  const colour = SEVERITY_COLOUR[finding.severity];
  /** @type {string[]} */
  const lines = [];
  lines.push(
    `  ${dim(`${index}.`)} ${colour(bold(SEVERITY_LABEL[finding.severity]))}  ${bold(finding.title)}`,
  );
  lines.push(wrap(finding.detail, 72, '     '));
  if (finding.evidence) {
    for (const line of finding.evidence.split('\n')) {
      lines.push(`     ${dim('│')} ${dim(line)}`);
    }
  }
  if (finding.fix) {
    lines.push(`     ${green('→')} ${hanging(finding.fix, 70, '       ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {number} score
 * @param {number} width
 * @returns {string}
 */
function renderBar(score, width) {
  const filled = Math.round((score / 100) * width);
  return '█'.repeat(filled) + dim('░'.repeat(width - filled));
}

/**
 * Wrap text to a width, indenting continuation lines.
 *
 * @param {string} text
 * @param {number} width
 * @param {string} indent
 * @returns {string}
 */
function wrap(text, width, indent) {
  const words = text.split(/\s+/);
  /** @type {string[]} */
  const lines = [];
  let line = '';

  for (const word of words) {
    if (line === '') {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += ' ' + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);

  return lines.map((l) => indent + l).join('\n');
}

/**
 * Wrap text whose first line already sits after a prefix, so only the
 * continuation lines are indented.
 *
 * @param {string} text
 * @param {number} width
 * @param {string} indent
 * @returns {string}
 */
function hanging(text, width, indent) {
  return wrap(text, width, indent).trimStart();
}
