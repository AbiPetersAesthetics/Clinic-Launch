// A server board shown inside ALFRED (?embed=1): the board's own title block is hidden, because the
// ALFRED page above it already carries the title, verdict and KPIs, and the board reports its height
// to the page so the frame grows to fit and there is one scroll, not two (UX plan 2.8).
// The shared board tokens (white page, 12px cards, pill buttons, slate eyebrow dot, focus ring) are
// injected into every board except the Build Cash Board, which stays exactly as the owner's master
// record (owner, 15 Nov 2026).
import TOKENS from "./board-tokens.css";

const HEIGHT_SCRIPT = `<script>(function(){
  if (window.parent === window) return;
  var last = 0;
  function send(){ var h = Math.ceil(document.documentElement.getBoundingClientRect().height); if (Math.abs(h - last) > 2) { last = h; window.parent.postMessage({ type: "alfred-board-height", height: h }, "*"); } }
  window.addEventListener("load", send); window.addEventListener("resize", send);
  try { new ResizeObserver(send).observe(document.body); } catch (e) { setInterval(send, 1000); }
  document.addEventListener("click", function(){ setTimeout(send, 60); });
  send();
})();</script>`;

const HIDE_HEAD = `<style>html,body{overflow:hidden;min-height:0!important}.board>.head:first-child{display:none!important}body{padding-top:0!important}</style>`;

export function withTokens(html: string): string {
  return html.includes("</head>") ? html.replace("</head>", `<style>${TOKENS}</style></head>`) : `<style>${TOKENS}</style>${html}`;
}

export function embedChrome(html: string, opts: { embed: boolean; hideHead?: boolean }): string {
  if (!opts.embed) return html;
  const inject = `${opts.hideHead === false ? "<style>html,body{overflow:hidden;min-height:0!important}</style>" : HIDE_HEAD}${HEIGHT_SCRIPT}`;
  return html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, `${inject}</body>`) : html + inject;
}
