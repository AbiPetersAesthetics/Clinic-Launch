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

// Section menu (owner, 18 Nov 2026: "a sub menu floating to the left ... stuff should be
// automatically closed and we can open it. Do it for the entire build"). Every card or section with
// a heading becomes a section. With three or more, each starts closed with only its heading showing,
// opens from the heading, and is listed to ALFRED, whose left menu opens it and scrolls to it. With
// fewer, the board is left exactly as it was. Content and figures are never changed, only shown.
const SECTIONS_SCRIPT = `<style>
.alf-shut>:not(.alf-keep){display:none!important}
.alf-sec h2.alf-h{cursor:pointer;display:flex;align-items:center;gap:8px}
.alf-sec h2.alf-h::before{content:"";flex:none;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);opacity:.55;transition:transform .15s;margin-right:2px}
.alf-sec:not(.alf-shut) h2.alf-h::before{transform:rotate(45deg)}
</style><script>(function(){
  if (window.parent === window) return;
  var secs = [];
  function setup(){
    var hs = [].slice.call(document.querySelectorAll("h2"));
    hs.forEach(function(h){
      if (h.closest("[hidden]") || h.closest("dialog")) return;
      var c = h.closest(".card, section");
      if (!c || c === document.body) return;
      for (var i = 0; i < secs.length; i++) if (secs[i].c === c || secs[i].c.contains(c)) return;
      var hc = h; while (hc.parentElement && hc.parentElement !== c) hc = hc.parentElement;
      if (hc.parentElement !== c) return;
      secs.push({ c: c, h: h, hc: hc, title: (h.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 70) });
    });
    if (secs.length < 3) { secs = []; post(); return; }
    secs.forEach(function(s, i){
      s.hc.classList.add("alf-keep");
      var p = s.hc.previousElementSibling;
      while (p && !p.querySelector("table,ul,ol,canvas,svg,img,input,button") && (p.textContent || "").length < 80) { p.classList.add("alf-keep"); p = p.previousElementSibling; }
      s.c.classList.add("alf-sec", "alf-shut");
      s.h.classList.add("alf-h");
      s.h.setAttribute("role", "button"); s.h.setAttribute("tabindex", "0"); s.h.setAttribute("aria-expanded", "false");
      function toggle(){ set(i, s.c.classList.contains("alf-shut")); post(); }
      s.h.addEventListener("click", toggle);
      s.h.addEventListener("keydown", function(e){ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    post();
  }
  function set(i, open){ var s = secs[i]; if (!s) return; s.c.classList.toggle("alf-shut", !open); s.h.setAttribute("aria-expanded", String(open)); window.dispatchEvent(new Event("resize")); }
  function post(){ window.parent.postMessage({ type: "alfred-board-sections", items: secs.map(function(s, i){ return { id: i, title: s.title, open: !s.c.classList.contains("alf-shut") }; }) }, "*"); }
  window.addEventListener("message", function(e){
    var d = e.data || {};
    if (d.type === "alfred-sec-set") { set(d.id, !!d.open); post(); }
    if (d.type === "alfred-sec-go" && secs[d.id]) { set(d.id, true); post(); var c = secs[d.id].c; setTimeout(function(){ window.parent.postMessage({ type: "alfred-board-top", id: d.id, top: c.getBoundingClientRect().top + window.scrollY }, "*"); }, 80); }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();</script>`;

const HIDE_HEAD = `<style>html,body{overflow:hidden;min-height:0!important}.board>.head:first-child{display:none!important}body{padding-top:0!important}@media(min-width:640px){body{padding-inline:2px!important}}</style>`;

export function withTokens(html: string): string {
  return html.includes("</head>") ? html.replace("</head>", `<style>${TOKENS}</style></head>`) : `<style>${TOKENS}</style>${html}`;
}

export function embedChrome(html: string, opts: { embed: boolean; hideHead?: boolean }): string {
  if (!opts.embed) return html;
  const inject = `${opts.hideHead === false ? "<style>html,body{overflow:hidden;min-height:0!important}</style>" : HIDE_HEAD}${HEIGHT_SCRIPT}${SECTIONS_SCRIPT}`;
  return html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, `${inject}</body>`) : html + inject;
}
