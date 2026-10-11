// @ts-nocheck
// The Launch OS copy of the Winchester Build Cash Board: the cash page only (the rooms and
// kit are Launch OS's own Rooms & Kit tab), as a complete document the Build Cash tab frames.
export function embedBoard(html: string): string {
  let s = html;
  function cut(a, b, replacement) { const i = s.indexOf(a); const j = s.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error("board embed: markers missing " + a.slice(0, 60)); s = s.slice(0, i) + replacement + s.slice(j); }
  function rep(o, n) { if (!s.includes(o)) throw new Error("board embed: missing " + o.slice(0, 80)); s = s.replace(o, () => n); }

  // The tabs and the page wrapper.
  cut(`<div class="tabs" role="tablist" aria-label="Pages">`, `<div id="page-cash">\n`, "");
  rep(`<div id="page-cash">\n`, "");
  // Abi's page, up to the Chart.js script: its closing div and the board's are dropped,
  // and the page-cash closing div now closes the board.
  cut(`<div id="page-abi" class="abi" hidden>`, `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js`, "");
  rep(`<p>Two pages: the cash, and Abi's page for the rooms and the kit (the tab above). This page: where the money comes from`, `<p>Where the money comes from`);
  // The pages and Abi's page script.
  cut(`  // ── Pages ──`, `  try { new MutationObserver(`, "");
  // The tabs styling has nothing to style now: the three lines starting ".tabs".
  s = s.split(String.fromCharCode(10)).filter(line => !line.startsWith(".tabs ")).join(String.fromCharCode(10));
  rep(`<div class="tag">Designed for A3 landscape. Hover any bar for its figure.</div>`, `<div class="tag">Live from the Launch OS plan. Hover any bar for its figure.</div>`);

  // A complete document, with the title in the head.
  const t = s.match(/<title>([^<]*)<\/title>/); const title = t ? t[1] : "Winchester Build Cash Board"; s = s.replace(/<title>[^<]*<\/title>\n?/, "");
  // Launch OS is light only, so the board is pinned light to match it.
  return `<!doctype html>\n<html lang="en-GB" data-theme="light">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>html, body { margin: 0; }</style>\n</head>\n<body>\n${s}\n</body>\n</html>\n`;
}
