/**
 * Sightline front end.
 *
 * No framework, no build step. The report is a plain JSON document and the page
 * is a rendering of it, so there is nothing here worth a runtime dependency.
 * Text is inserted via textContent throughout — report fields echo content from
 * the audited site, and that is untrusted input.
 */

const form = /** @type {HTMLFormElement} */ (document.getElementById('audit-form'));
const input = /** @type {HTMLInputElement} */ (document.getElementById('url'));
const submit = /** @type {HTMLButtonElement} */ (document.getElementById('submit'));
const status = /** @type {HTMLElement} */ (document.getElementById('status'));
const reportSection = /** @type {HTMLElement} */ (document.getElementById('report'));

/** @type {any} */
let currentReport = null;
let showAllFindings = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const target = input.value.trim();
  if (target === '') return;

  submit.disabled = true;
  submit.textContent = 'Auditing…';
  showStatus('Fetching robots.txt, the page itself, and probing each crawler. This takes a few seconds.');

  try {
    const response = await fetch(`/api/audit?url=${encodeURIComponent(target)}`);
    const payload = await response.json();

    if (!response.ok) {
      showStatus(payload.error ?? 'That audit could not be completed.', true);
      return;
    }

    currentReport = payload;
    showAllFindings = false;
    render(payload);
    hideStatus();
    reportSection.hidden = false;
    reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    showStatus('Could not reach the audit service. Check your connection and try again.', true);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Run free audit';
  }
});

/**
 * @param {string} message
 * @param {boolean} [isError]
 */
function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
  status.hidden = false;
}

function hideStatus() {
  status.hidden = true;
}

/**
 * @param {any} report
 */
function render(report) {
  renderHeadline(report);
  renderPillars(report);
  renderCrawlers(report);
  renderFindings(report);
  renderRemediation(report);

  text(
    'report-meta',
    `${report.findings.length} checks reported · engine ${report.meta.engineVersion} · audited ${new Date(report.generatedAt).toLocaleString()}`,
  );
}

/**
 * @param {any} report
 */
function renderHeadline(report) {
  const dial = /** @type {SVGCircleElement} */ (document.getElementById('dial-value'));
  const circumference = 327;
  dial.style.strokeDashoffset = String(circumference - (report.score / 100) * circumference);
  dial.style.stroke = scoreColour(report.score);

  text('score-number', String(report.score));
  text('score-grade', `Grade ${report.grade}`);
  text('report-host', hostOf(report.origin));
  text('score-summary', summarise(report.score));
  text('posture-summary', report.postureSummary);
  text('posture-label', postureLabel(report.posture));
}

/**
 * @param {any} report
 */
function renderPillars(report) {
  const container = /** @type {HTMLElement} */ (document.getElementById('pillars'));
  container.replaceChildren();

  /** @type {Record<string,string>} */
  const questions = {
    reach: 'Can AI systems fetch your pages?',
    comprehension: 'Can they read what they fetch?',
    attribution: 'Will they credit you correctly?',
    governance: 'Is your policy deliberate?',
  };
  /** @type {Record<string,string>} */
  const names = {
    reach: 'Reach',
    comprehension: 'Comprehension',
    attribution: 'Attribution',
    governance: 'Governance',
  };

  for (const pillar of report.pillars) {
    const card = el('div', 'pillar');
    const head = el('div', 'pillar-head');
    head.append(el('span', 'pillar-name', names[pillar.pillar] ?? pillar.pillar));

    const score = el('span', 'pillar-score', String(pillar.score));
    score.style.color = scoreColour(pillar.score);
    head.append(score);

    const bar = el('div', 'pillar-bar');
    const fill = el('span');
    fill.style.width = `${pillar.score}%`;
    fill.style.background = scoreColour(pillar.score);
    bar.append(fill);

    card.append(head, bar, el('p', 'pillar-q', questions[pillar.pillar] ?? ''));
    container.append(card);
  }
}

/**
 * The two lists side by side are the argument the whole product makes: one
 * column is expensive to block, the other is free.
 *
 * @param {any} report
 */
function renderCrawlers(report) {
  const answer = /** @type {HTMLElement} */ (document.getElementById('answer-engines'));
  const training = /** @type {HTMLElement} */ (document.getElementById('training-crawlers'));
  answer.replaceChildren();
  training.replaceChildren();

  const engines = report.agents
    .filter((/** @type {any} */ a) => a.agent.reachWeight > 0)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => b.agent.reachWeight - a.agent.reachWeight);

  for (const verdict of engines) {
    const blockedAtEdge = verdict.blockedBy === 'http';
    answer.append(
      crawlerRow({
        state: verdict.allowed ? 'allowed' : 'blocked',
        stateClass: verdict.allowed ? 'allowed' : 'blocked',
        token: verdict.agent.token,
        note: blockedAtEdge ? 'blocked by your server, not robots.txt' : verdict.agent.product,
      }),
    );
  }

  for (const verdict of report.agents.filter((/** @type {any} */ a) => a.agent.purpose === 'training')) {
    training.append(
      crawlerRow({
        state: verdict.allowed ? 'allowed' : 'opted out',
        stateClass: verdict.allowed ? 'open' : 'optout',
        token: verdict.agent.token,
        note: verdict.agent.operator,
      }),
    );
  }
}

/**
 * @param {{state: string, stateClass: string, token: string, note: string}} row
 * @returns {HTMLElement}
 */
function crawlerRow({ state, stateClass, token, note }) {
  const li = el('li');
  li.append(
    el('span', `crawler-state ${stateClass}`, state),
    el('span', 'crawler-name', token),
    el('span', 'crawler-product', note),
  );
  return li;
}

/**
 * @param {any} report
 */
function renderFindings(report) {
  const list = /** @type {HTMLElement} */ (document.getElementById('findings'));
  const toggle = /** @type {HTMLButtonElement} */ (document.getElementById('show-all'));
  list.replaceChildren();

  const actionable = report.findings.filter((/** @type {any} */ f) => f.severity !== 'info');
  const visible = showAllFindings ? report.findings : actionable.slice(0, 6);

  if (visible.length === 0) {
    list.append(el('p', 'card-sub', 'Nothing to fix. Every check passed.'));
  }

  for (const finding of visible) {
    const item = el('li', 'finding');
    const head = el('div', 'finding-head');
    head.append(
      el('span', `sev ${finding.severity}`, finding.severity),
      el('span', 'finding-title', finding.title),
    );
    item.append(head, el('p', 'finding-detail', finding.detail));

    if (finding.evidence) item.append(el('pre', 'finding-evidence', finding.evidence));
    if (finding.fix) item.append(el('p', 'finding-fix', finding.fix));

    list.append(item);
  }

  const hidden = report.findings.length - visible.length;
  toggle.hidden = hidden <= 0 && showAllFindings;
  toggle.textContent = showAllFindings
    ? 'Show priorities only'
    : `Show all ${report.findings.length} findings`;
  toggle.onclick = () => {
    showAllFindings = !showAllFindings;
    renderFindings(currentReport);
  };
}

/**
 * @param {any} report
 */
function renderRemediation(report) {
  const steps = /** @type {HTMLElement} */ (document.getElementById('steps'));
  steps.replaceChildren();
  for (const step of report.remediation.steps) steps.append(el('li', '', step));

  setCode('out-robots', report.remediation.robotsTxt);
  setCode('out-llms', report.remediation.llmsTxt);
  setCode('out-jsonld', report.remediation.jsonLd);
}

/**
 * @param {string} id
 * @param {string} value
 */
function setCode(id, value) {
  const pre = document.getElementById(id);
  const code = pre?.querySelector('code');
  if (code) code.textContent = value;
}

// --- Tabs and copy ---------------------------------------------------------

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('is-active'));
    tab.classList.add('is-active');
    const target = tab.getAttribute('data-target');
    if (target) document.getElementById(target)?.classList.add('is-active');
  });
});

document.querySelector('[data-copy]')?.addEventListener('click', async (event) => {
  const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
  const active = document.querySelector('.panel.is-active code');
  if (!active?.textContent) return;

  try {
    await navigator.clipboard.writeText(active.textContent);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Press ⌘C';
  }
  setTimeout(() => {
    button.textContent = 'Copy';
  }, 1800);
});

// --- Helpers ---------------------------------------------------------------

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

/**
 * @param {string} id
 * @param {string} value
 */
function text(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

/**
 * @param {number} score
 * @returns {string}
 */
function scoreColour(score) {
  const styles = getComputedStyle(document.documentElement);
  if (score >= 80) return styles.getPropertyValue('--ok').trim();
  if (score >= 55) return styles.getPropertyValue('--high').trim();
  return styles.getPropertyValue('--critical').trim();
}

/**
 * @param {number} score
 * @returns {string}
 */
function summarise(score) {
  if (score >= 90) return 'AI systems can reach, read and correctly attribute this site.';
  if (score >= 80) return 'Fundamentally healthy, with a few fixable gaps.';
  if (score >= 65) return 'Reachable, but leaving real AI visibility on the table.';
  if (score >= 50) return 'Significant problems are limiting how often AI systems can use you.';
  if (score >= 35) return 'Serious barriers. Most assistants will struggle to cite you.';
  return 'This site is effectively invisible to AI assistants.';
}

/**
 * @param {string} posture
 * @returns {string}
 */
function postureLabel(posture) {
  /** @type {Record<string,string>} */
  const labels = {
    open: 'Open',
    'citation-only': 'Citation-only',
    'training-only': 'Backwards',
    closed: 'Closed',
    incoherent: 'Incoherent',
    unconfigured: 'Unconfigured',
  };
  return labels[posture] ?? posture;
}

/**
 * @param {string} origin
 * @returns {string}
 */
function hostOf(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

// Deep-link support: /?url=example.com runs the audit on load, which makes
// every generated report shareable.
const preset = new URLSearchParams(location.search).get('url');
if (preset) {
  input.value = preset;
  form.requestSubmit();
}
