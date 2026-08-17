/**
 * Tell — front end.
 *
 * No framework, no build. State is a handful of variables and localStorage, so
 * a player who has already played today sees their result rather than a fresh
 * board — which matters, because the daily constraint is what makes the score
 * worth posting.
 *
 * Sample text is inserted with textContent throughout: it is player-submitted
 * content and must never be treated as markup.
 */

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

const screens = { intro: $('intro'), game: $('game'), result: $('result') };

/** @type {any} */
let puzzle = null;
/** @type {{pairId: string, choice: 'left'|'right', confidence: number}[]} */
let answers = [];
let round = 0;
/** @type {'left'|'right'|null} */
let pending = null;

const STORE_KEY = 'tell:last';

// --- Boot ------------------------------------------------------------------

(async function boot() {
  puzzle = await (await fetch('/api/puzzle')).json();
  $('puzzle-no').textContent = `#${puzzle.number}`;
  $('intro-meta').textContent = `Puzzle #${puzzle.number} · ${puzzle.pairs.length} rounds · about two minutes`;

  const saved = load();
  if (saved && saved.date === puzzle.date) {
    showResult(saved.payload);
  }
})();

$('start').addEventListener('click', () => {
  answers = [];
  round = 0;
  show('game');
  renderRound();
});

// --- Playing ---------------------------------------------------------------

function renderRound() {
  const pair = puzzle.pairs[round];
  pending = null;

  $('topic').textContent = pair.topic;
  $('confidence').hidden = true;

  for (const side of /** @type {const} */ (['left', 'right'])) {
    const button = $(`sample-${side}`);
    const span = button.querySelector('span');
    if (span) span.textContent = pair[side].text;
    button.classList.remove('chosen');
    button.removeAttribute('disabled');
  }

  const progress = $('progress');
  progress.replaceChildren();
  for (let i = 0; i < puzzle.pairs.length; i++) {
    const tick = document.createElement('i');
    if (i < round) tick.className = 'done';
    else if (i === round) tick.className = 'current';
    progress.append(tick);
  }
}

for (const side of /** @type {const} */ (['left', 'right'])) {
  $(`sample-${side}`).addEventListener('click', () => {
    pending = side;
    $('sample-left').classList.toggle('chosen', side === 'left');
    $('sample-right').classList.toggle('chosen', side === 'right');
    $('confidence').hidden = false;
    $('confidence').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

const slider = /** @type {HTMLInputElement} */ ($('conf'));
slider.addEventListener('input', () => {
  const value = Number(slider.value);
  $('conf-out').textContent = `${value}%`;
  $('conf-hint').textContent = confidenceHint(value);
});

$('lock').addEventListener('click', async () => {
  if (!pending) return;

  answers.push({
    pairId: puzzle.pairs[round].id,
    choice: pending,
    confidence: Number(slider.value),
  });

  round++;
  if (round < puzzle.pairs.length) {
    slider.value = '75';
    $('conf-out').textContent = '75%';
    $('conf-hint').textContent = confidenceHint(75);
    renderRound();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const response = await fetch('/api/play', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date: puzzle.date, answers }),
  });
  const payload = await response.json();
  save({ date: puzzle.date, payload });
  showResult(payload);
});

/**
 * @param {number} value
 * @returns {string}
 */
function confidenceHint(value) {
  if (value <= 55) return 'Basically a coin flip';
  if (value <= 70) return 'Leaning that way';
  if (value <= 85) return 'Fairly confident';
  if (value < 100) return 'Very confident';
  return 'Certain. No hedging.';
}

// --- Result ----------------------------------------------------------------

/**
 * @param {any} payload
 */
function showResult(payload) {
  const { result, reveal, share, percentile: rank, playedToday, averageAccuracy } = payload;

  $('num-sure').textContent = `${Math.round(result.meanConfidence * 100)}%`;
  $('num-right').textContent = `${Math.round(result.accuracy * 100)}%`;
  $('archetype-name').textContent = result.archetype.name;
  $('archetype-verdict').textContent = result.archetype.verdict;
  $('archetype-detail').textContent = result.archetype.detail;
  $('result-eyebrow').textContent = `Tell #${puzzle.number} · ${result.correct} of ${result.rounds}`;
  $('grid').textContent = share.split('\n')[1] ?? '';

  $('share-note').textContent =
    playedToday > 1
      ? `You beat ${rank}% of today's players. Average so far: ${Math.round((averageAccuracy ?? 0) * 100)}%.`
      : 'First play of the day.';

  renderStats(result);
  renderReveal(reveal, result);

  $('share').onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ text: share });
      else await navigator.clipboard.writeText(share);
      $('share').textContent = 'Copied';
    } catch {
      $('share').textContent = 'Copy failed';
    }
    setTimeout(() => ($('share').textContent = 'Copy result'), 1800);
  };

  show('result');
}

/**
 * @param {any} result
 */
function renderStats(result) {
  const list = $('stats-list');
  list.replaceChildren();

  /** @type {[string, string, string][]} */
  const rows = [
    ['Overconfidence', signed(result.overconfidence), 'confidence minus accuracy'],
    ['Brier score', result.brier.toFixed(3), 'mean squared error — 0.25 is guessing'],
    ['Skill vs chance', signed(result.skillVsChance), 'improvement over always guessing'],
    ['Calibration', result.calibration.toFixed(3), 'reliability — lower is better'],
    ['Discrimination', result.discrimination.toFixed(3), 'resolution — higher is better'],
  ];

  for (const [term, value, note] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = `${value} `;
    const small = document.createElement('small');
    small.textContent = `— ${note}`;
    dd.append(small);
    list.append(dt, dd);
  }
}

/**
 * @param {any[]} reveal
 * @param {any} result
 */
function renderReveal(reveal, result) {
  const list = $('reveal');
  list.replaceChildren();

  reveal.forEach((item, index) => {
    const marked = result.answers[index];
    const li = document.createElement('li');

    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = marked ? (marked.correct ? '🟩' : '🟥') : '⬜';

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `The human wrote the ${item.humanSide} one.`;

    const prov = document.createElement('span');
    prov.className = 'prov';
    prov.textContent = `human: ${item.human.provenance} · ai: ${item.ai.model ?? item.ai.provenance}`;

    li.append(mark, who, prov);
    list.append(li);
  });
}

// --- Submission loop -------------------------------------------------------

$('submit-btn').addEventListener('click', async () => {
  const text = /** @type {HTMLTextAreaElement} */ ($('submit-text')).value;
  const topic = /** @type {HTMLSelectElement} */ ($('submit-topic')).value;

  const response = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, topic }),
  });
  const payload = await response.json();
  $('submit-note').textContent = payload.error ?? payload.message;
});

// --- Helpers ---------------------------------------------------------------

/**
 * @param {keyof typeof screens} name
 */
function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
}

/**
 * @param {number} value
 * @returns {string}
 */
function signed(value) {
  const percent = Math.round(value * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/**
 * @param {{date: string, payload: unknown}} state
 */
function save(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* private browsing — the game still works, it just will not remember */
  }
}

/**
 * @returns {{date: string, payload: any}|null}
 */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
