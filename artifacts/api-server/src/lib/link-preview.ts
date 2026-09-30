// The picture and title behind a link Abi pastes: kit items, and the colours and
// finishes. The server fetches the page once; private and local addresses are refused.

// A link Abi adds: http or https, to a public host.
export function publicHttpUrl(v: unknown): URL | null {
  if (typeof v !== "string") return null;
  let u: URL; try { u = new URL(v.trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.includes(":")) return null;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) { const a = +m[1], b = +m[2]; if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return null; }
  return u;
}

// The picture and title a page offers for sharing (og:image and friends), or the
// image itself when the link is one. Never throws; a page with nothing gives nulls.
export async function linkPreview(u: URL): Promise<{ imageUrl: string | null; title: string | null }> {
  try {
    const res = await fetch(u.toString(), { redirect: "follow", signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 (compatible; LaunchOS/1.0)", accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5" } });
    if (!res.ok) return { imageUrl: null, title: null };
    const type = res.headers.get("content-type") || "";
    const finalUrl = res.url || u.toString();
    if (type.startsWith("image/")) return { imageUrl: finalUrl, title: null };
    if (!/text\/html|application\/xhtml/.test(type)) return { imageUrl: null, title: null };
    const html = (await res.text()).slice(0, 600000);
    const meta = (names: string[]) => {
      for (const n of names) {
        const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, "i"));
        if (a) { const c = a[0].match(/content=["']([^"']+)["']/i); if (c) return c[1]; }
        const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${n}["']`, "i"));
        if (b) return b[1];
      }
      return null;
    };
    let img = meta(["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
    if (!img) { const l = html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i); if (l) img = l[1]; }
    if (!img) { const first = html.match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i); if (first) img = first[1]; }
    const rawTitle = meta(["og:title"]) || (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i) || [])[1] || null;
    let imageUrl: string | null = null;
    if (img) { try { const abs = new URL(img.replace(/&amp;/g, "&"), finalUrl).toString(); if (/^https?:/.test(abs)) imageUrl = abs; } catch { imageUrl = null; } }
    const title = rawTitle ? rawTitle.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, "\"").replace(/\s+/g, " ").trim().slice(0, 200) : null;
    return { imageUrl, title };
  } catch { return { imageUrl: null, title: null }; }
}
