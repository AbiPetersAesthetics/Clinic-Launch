import { Router } from "express";
import { db, competitorsTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "Cache-Control": "no-cache",
};

async function fetchPage(url: string, timeoutMs = 9000): Promise<{ html: string; ok: boolean }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS });
    clearTimeout(t);
    if (!resp.ok) return { html: "", ok: false };
    const html = await resp.text();
    return { html, ok: true };
  } catch {
    return { html: "", ok: false };
  }
}

function extractText(html: string, maxLen = 3500): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Extract <head> section including meta tags and JSON-LD for GPT */
function extractHead(html: string): string {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  // Strip style/script except JSON-LD
  const cleaned = head
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 3000);
}

/** Extract footer/contact section which almost always has the physical address */
function extractFooterAndContact(html: string): string {
  const lower = html.toLowerCase();
  // Try to grab footer element
  const footerMatch = html.match(/<footer[^>]*>([\s\S]{0,4000}?)<\/footer>/i)?.[1] || "";
  // Also grab anything near "contact" section
  const contactIdx = lower.lastIndexOf("contact");
  const contactSnip = contactIdx > -1 ? html.slice(Math.max(0, contactIdx - 200), contactIdx + 1500) : "";
  // Also grab last 1500 chars of body (often footer content)
  const bodyEnd = html.slice(-2000);
  const combined = [footerMatch, contactSnip, bodyEnd].join("\n");
  return extractText(combined, 3000);
}

/** Extract all iframe src URLs (Google Maps embeds) */
function extractIframeSrcs(html: string): string[] {
  return [...html.matchAll(/(?:src|data-src)="([^"]*(?:google\.com\/maps|maps\.google)[^"]*)"/gi)]
    .map(m => m[1]);
}

/** Extract microdata / itemprop rating values */
function extractMicrodataRating(html: string): string {
  const itemprop = html.match(/itemprop="ratingValue"[^>]*content="([\d.]+)"/i)
    || html.match(/itemprop="ratingValue"[^>]*>([\d.]+)</i)
    || html.match(/content="([\d.]+)"[^>]*itemprop="ratingValue"/i);
  return itemprop?.[1] || "";
}

function extractMeta(html: string): string {
  return (html.match(/<meta[^>]+>/gi) || [])
    .filter(m => /name="(description|keywords|title)"|property="og:|twitter:/i.test(m))
    .map(m => {
      const content = m.match(/content="([^"]+)"/)?.[1] || m.match(/content='([^']+)'/)?.[1] || "";
      const name = m.match(/(?:name|property)="([^"]+)"/)?.[1] || "";
      return `${name}: ${content}`;
    }).join("\n").slice(0, 1500);
}

function extractJsonLd(html: string): string {
  return (html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [])
    .map(m => m.replace(/<[^>]+>/g, "")).join("\n").slice(0, 3000);
}

function getTitle(html: string): string {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
}

// Serialise JSON fields for DB storage
function serialiseFields(data: Record<string, unknown>): Record<string, unknown> {
  for (const f of ["treatmentsJson", "strengthsJson", "weaknessesJson", "commonPraiseJson", "commonComplaintsJson"]) {
    if (Array.isArray(data[f])) data[f] = JSON.stringify(data[f]);
    else if (typeof data[f] !== "string") data[f] = "[]";
  }
  if (data.pricingJson && typeof data.pricingJson === "object" && !Array.isArray(data.pricingJson)) {
    data.pricingJson = JSON.stringify(data.pricingJson);
  } else if (typeof data.pricingJson !== "string") {
    data.pricingJson = "{}";
  }
  return data;
}

// Haversine distance in miles between two lat/lng points
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// APA Winchester reference point
const APA_LAT = 51.0619;
const APA_LNG = -1.3104;

function parseFollowers(raw: string): number {
  const s = raw.replace(/,/g, "").trim();
  if (/[mM]$/.test(s)) return Math.round(parseFloat(s) * 1_000_000);
  if (/[kK]$/.test(s)) return Math.round(parseFloat(s) * 1000);
  return parseInt(s) || 0;
}

// Core lookup logic — used by both /lookup and /enrich
async function runLookup(url: string): Promise<{ data: Record<string, unknown>; sources: string[]; igFollowers: number; googleRating: string; googleReviewCount: number; lat: string; lng: string; distanceMiles: string }> {
  const sources: string[] = [];

  // Detect Instagram
  let isInstagram = false;
  let igHandle = "";
  const igUrlMatch = url.match(/instagram\.com\/([^/?&#\s]+)/);
  if (igUrlMatch) {
    isInstagram = true;
    igHandle = igUrlMatch[1];
    url = `https://www.instagram.com/${igHandle}/`;
  }

  // ── Phase 1: Fetch main page ─────────────────────────────────────────────
  const mainResult = await fetchPage(url, 12000);
  if (!mainResult.ok || !mainResult.html) {
    throw new Error("Could not reach that page. Check the URL and try again.");
  }
  const mainHtml = mainResult.html;
  sources.push(url);

  const mainJsonLd = extractJsonLd(mainHtml);
  const mainBody = extractText(mainHtml, 4000);

  // ── Phase 2: Discover sub-pages & Instagram in parallel ──────────────────
  let subPageHrefs: string[] = [];
  let baseUrl = "";

  try {
    baseUrl = new URL(url).origin;
    const subPagePattern = /\/(about|treatments?|services?|pric(e|ing|elist)|menu|treatment-menu|what-we-do|our-treatments|injectables|fillers?|book|contact|clinic)/i;
    const seen = new Set<string>();
    subPageHrefs = [...mainHtml.matchAll(/href="([^"#?]+)"/g)]
      .map(m => m[1])
      .filter(h => h.startsWith("/") && subPagePattern.test(h) && !seen.has(h) && seen.add(h) !== undefined)
      .slice(0, 4);
  } catch { /* ignore URL parse errors */ }

  // Find Instagram handle in main page HTML (if not already Instagram)
  if (!isInstagram) {
    const igPageMatch = mainHtml.match(/instagram\.com\/([^/?&#"'\s\\]+)/i);
    if (igPageMatch && !["p", "explore", "reel", "stories", "tv"].includes(igPageMatch[1])) {
      igHandle = igPageMatch[1];
    }
  }

  // Fetch sub-pages and Instagram page in parallel
  const subFetches = subPageHrefs.slice(0, 3).map(h => fetchPage(`${baseUrl}${h}`, 7000));
  const igFetch = igHandle ? fetchPage(`https://www.instagram.com/${igHandle}/`, 8000) : Promise.resolve({ html: "", ok: false });

  const [subResults, igPageResult] = await Promise.all([
    Promise.allSettled(subFetches),
    igFetch,
  ]);

  // Collect all sub-page HTML for use throughout
  const allSubHtml = subResults.map(r => r.status === "fulfilled" ? (r.value.html || "") : "").join("");

  // ── Phase 3a: Google Rating — multiple extraction strategies ──────────────
  let googleRating = "";
  let googleReviewCount = 0;

  // 1) JSON-LD aggregateRating on main page + sub-pages
  const ldRating = mainJsonLd.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/);
  const ldCount = mainJsonLd.match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d+)"?/);
  if (ldRating) googleRating = ldRating[1];
  if (ldCount) googleReviewCount = parseInt(ldCount[1]);

  if (!googleRating) {
    for (const r of subResults) {
      if (r.status === "fulfilled" && r.value.ok) {
        const subLd = extractJsonLd(r.value.html);
        const sr = subLd.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/);
        const sc = subLd.match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d+)"?/);
        if (sr) { googleRating = sr[1]; if (sc) googleReviewCount = parseInt(sc[1]); break; }
      }
    }
  }

  // 2) HTML microdata (itemprop="ratingValue") on all pages
  if (!googleRating) {
    const allHtmlForRating = mainHtml + allSubHtml;
    const mdr = extractMicrodataRating(allHtmlForRating);
    if (mdr) {
      googleRating = mdr;
      const mdc = allHtmlForRating.match(/itemprop="reviewCount"[^>]*content="(\d+)"/i)
        || allHtmlForRating.match(/itemprop="reviewCount"[^>]*>(\d+)</i);
      if (mdc) googleReviewCount = parseInt(mdc[1]);
    }
  }

  // 3) Body text patterns: "4.9 out of 5", "rated 4.8", "4.9/5", "★ 4.9"
  if (!googleRating) {
    const allBodyText = mainBody;
    const bodyRating = allBodyText.match(/\b([45]\.\d)\s*(?:out of 5|\/5|stars?|★|⭐)/i)
      || allBodyText.match(/(?:rated?|rating)\s*[:\s]*([45]\.\d)/i)
      || allBodyText.match(/Google\s+(?:rating|reviews?)[:\s]+([45]\.\d)/i);
    if (bodyRating) googleRating = bodyRating[1];
    const bodyCount = allBodyText.match(/(\d[\d,]+)\s*(?:Google\s+)?reviews?/i);
    if (bodyCount && !googleReviewCount) googleReviewCount = parseInt(bodyCount[1].replace(/,/g, ""));
  }

  // 4) Bing search by business name (works even for JS-rendered sites, less bot-blocked than Google)
  if (!googleRating) {
    try {
      const ldNameMatch = mainJsonLd.match(/"name"\s*:\s*"([^"]+)"/);
      const candidateName = ldNameMatch?.[1] || getTitle(mainHtml).split(/[-|·]/)[0].trim();
      if (candidateName) {
        // Bing returns structured knowledge panels with ratings in HTML
        const bq = encodeURIComponent(`"${candidateName}" aesthetics reviews`);
        const bingResult = await fetchPage(`https://www.bing.com/search?q=${bq}&mkt=en-GB`, 7000);
        if (bingResult.ok) {
          const bh = bingResult.html;
          // Bing knowledge panel rating: data-val="4.9" near "reviews" or aria-label="4.9 out of 5"
          const br = bh.match(/(\d\.\d)\s*(?:out of 5|\/5|stars?)/i)
            || bh.match(/data-[a-z]*rating[^=]*="([\d.]+)"/i)
            || bh.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/)
            || bh.match(/aria-label="([\d.]+) out of 5/i);
          const bc = bh.match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d[\d,]*)"?/)
            || bh.match(/([\d,]+)\s+(?:Google\s+)?reviews?/i);
          if (br) googleRating = br[1];
          if (bc && !googleReviewCount) googleReviewCount = parseInt(bc[1].replace(/,/g, ""));
        }

        // Fallback to Google search if Bing didn't find it
        if (!googleRating) {
          const gq = encodeURIComponent(`${candidateName} aesthetics Google reviews`);
          const googleResult = await fetchPage(`https://www.google.com/search?q=${gq}&hl=en-GB`, 6000);
          if (googleResult.ok) {
            const gh = googleResult.html;
            const sr = gh.match(/aria-label="Rated ([\d.]+) out of 5[^"]*,?\s*([\d,]+)\s*reviews?"/i)
              || gh.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/);
            const sc = gh.match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d[\d,]*)"?/)
              || gh.match(/([\d,]+)\s+Google\s+reviews?/i);
            if (sr) googleRating = sr[1];
            if (sc && !googleReviewCount) googleReviewCount = parseInt(sc[1].replace(/,/g, ""));
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  // ── Phase 4: Instagram followers ─────────────────────────────────────────
  let igFollowers = 0;

  // A) Website body text — many clinics show "X followers" as social proof
  const footerText = extractFooterAndContact(mainHtml);
  const bodyIgMatch = (mainBody + " " + footerText).match(/([\d,.]+[kKmM]?)\s*(?:Instagram\s+)?[Ff]ollowers/)
    || (mainBody + " " + footerText).match(/[Ff]ollowers[:\s]+([\d,.]+[kKmM]?)/);
  if (bodyIgMatch) igFollowers = parseFollowers(bodyIgMatch[1]);

  // B) Instagram page og:description
  if (!igFollowers) {
    const igHtml = isInstagram ? mainHtml : (igPageResult.ok ? igPageResult.html : "");
    if (igHtml) {
      const igDesc = igHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)?.[1]
        || igHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i)?.[1]
        || "";
      const followMatch = igDesc.match(/([\d,.]+[kKmM]?)\s*Followers/i);
      if (followMatch) igFollowers = parseFollowers(followMatch[1]);
      if (!igFollowers) {
        const edgeMatch = igHtml.match(/"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)\}/);
        if (edgeMatch) igFollowers = parseInt(edgeMatch[1]);
      }
      if (igHandle && igPageResult.ok) sources.push(`https://www.instagram.com/${igHandle}/`);
    }
  }

  // ── Phase 5: Pre-extract coordinates from structured data ────────────────
  // Nominatim geocoding runs AFTER GPT so GPT-extracted address is also available
  let lat = "";
  let lng = "";
  let distanceMiles = "";

  // A) JSON-LD geo on main page
  const ldLat = mainJsonLd.match(/"latitude"\s*:\s*"?([-\d.]+)"?/);
  const ldLng = mainJsonLd.match(/"longitude"\s*:\s*"?([-\d.]+)"?/);
  if (ldLat && ldLng) { lat = ldLat[1]; lng = ldLng[1]; }

  // B) Google Maps iframe src on any page (most reliable coord source after JSON-LD)
  if (!lat) {
    const allHtmlForMaps = mainHtml + allSubHtml;
    const mapSrcs = extractIframeSrcs(allHtmlForMaps);
    for (const src of mapSrcs) {
      // pb= format: !3d<lat>!4d<lng>
      const pb = src.match(/!3d([-\d.]{4,12})!4d([-\d.]{4,12})/i);
      // @lat,lng,zoom format
      const at = src.match(/@([-\d.]{4,12}),([-\d.]{4,12})/i);
      // ?ll=lat,lng or ?q=lat,lng
      const ll = src.match(/[?&](?:ll|q|center)=([-\d.]{4,12}),([-\d.]{4,12})/i);
      const match = pb || at || ll;
      if (match) { lat = match[1]; lng = match[2]; break; }
    }
  }

  // C) Also scan raw HTML for maps embed patterns not in iframe src (e.g. data-src, JS vars)
  if (!lat) {
    const allHtmlForMaps = mainHtml + allSubHtml;
    const pb = allHtmlForMaps.match(/!3d([-\d.]{4,12})!4d([-\d.]{4,12})/i);
    if (pb) { lat = pb[1]; lng = pb[2]; }
  }

  // ── Phase 6: Assemble combined page text for GPT ─────────────────────────
  const allTexts: string[] = [];

  const mainTitle = getTitle(mainHtml);
  const mainMeta = extractMeta(mainHtml);
  const mainHead = extractHead(mainHtml);
  const mainFooter = extractFooterAndContact(mainHtml);
  const mapIframeSrcs = extractIframeSrcs(mainHtml + allSubHtml);

  allTexts.push(
    `=== MAIN PAGE: ${url} ===` +
    `\nTITLE: ${mainTitle}` +
    `\nHEAD (meta/JSON-LD):\n${mainHead}` +
    `\nBODY TEXT:\n${mainBody}` +
    `\nFOOTER/CONTACT AREA:\n${mainFooter}` +
    (mapIframeSrcs.length ? `\nGOOGLE MAPS EMBED URLS:\n${mapIframeSrcs.join("\n")}` : "")
  );

  subResults.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.ok && result.value.html) {
      const href = subPageHrefs[i];
      const t = getTitle(result.value.html);
      const body = extractText(result.value.html, 2000);
      const footer = extractFooterAndContact(result.value.html);
      const jsonLd = extractJsonLd(result.value.html).slice(0, 600);
      allTexts.push(
        `=== SUB-PAGE: ${baseUrl}${href} ===` +
        `\nTITLE: ${t}` +
        `\nSTRUCTURED DATA:\n${jsonLd}` +
        `\nBODY:\n${body}` +
        (footer ? `\nFOOTER/CONTACT:\n${footer}` : "")
      );
      sources.push(`${baseUrl}${href}`);
    }
  });

  if (igFollowers > 0 || igHandle) {
    allTexts.push(`=== INSTAGRAM DATA ===\nHandle: @${igHandle}\nFollowers extracted: ${igFollowers}`);
  }

  const combinedText = allTexts.join("\n\n").slice(0, 18000);

  // ── Phase 6: GPT extraction ───────────────────────────────────────────────
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content: `You are a specialist medical aesthetics market intelligence analyst. Extract structured competitor data from multi-source web content. Prioritise JSON-LD structured data, explicit price mentions, and clear factual statements. Do not fabricate. If a field is absent, use the default (empty string, 0, false, or "unknown").`,
      },
      {
        role: "user",
        content: `Extract all competitor intelligence from this multi-source content and return a single JSON object.

${googleRating ? `CONFIRMED — googleRating: ${googleRating} — use exactly this value.` : ""}
${googleReviewCount ? `CONFIRMED — googleReviewCount: ${googleReviewCount} — use exactly this value.` : ""}
${igFollowers > 0 ? `CONFIRMED — instagramFollowers: ${igFollowers} — use exactly this value.` : ""}
${igHandle ? `CONFIRMED — instagram handle: @${igHandle} — use without @ symbol.` : ""}
${lat && lng ? `CONFIRMED — lat: ${lat}, lng: ${lng}, distanceMiles: ${distanceMiles} — use exactly these values.` : ""}

MULTI-SOURCE CONTENT:
${combinedText}

Return ONLY valid JSON with these fields (use defaults if absent):
{
  "name": "",
  "address": "FULL street address including postcode — look in footer, contact page, Google Maps iframe title, JSON-LD, or anywhere in body text",
  "phone": "",
  "website": "${isInstagram ? "" : url}",
  "instagram": "${igHandle}",
  "facebook": "",
  "bookingLink": "online booking URL if different from main website, else ''",
  "googleRating": "${googleRating || "look hard — check for star ratings, Google review widgets, Trustpilot score, or any rating mentioned as X/5 or X out of 5 in the body text; use the numeric value only e.g. 4.9"}",
  "googleReviewCount": ${googleReviewCount || 0},
  "instagramFollowers": ${igFollowers},
  "clinicType": "nurse-led | doctor-led | dentist-led | beautician-led | mixed practitioner | laser/skin specialist | injectables-only | salon-led aesthetics | chain/brand clinic | unknown",
  "premisesType": "high street shopfront | medical clinic | rented room | beauty salon room | home clinic | dental clinic | chain clinic | destination clinic | unknown",
  "positioningCategory": "luxury medical clinic | natural-results nurse-led clinic | doctor-led premium clinic | beauty salon aesthetics | budget injector | skin/laser specialist | holistic wellness clinic | chain clinic | home-based trusted local | social-media-led injector",
  "targetAudience": "",
  "practitionerType": "",
  "yearsExperience": 0,
  "saveFace": false,
  "jccp": false,
  "independentPrescriber": false,
  "nhsBackground": false,
  "credentialsNotes": "list all qualifications, accreditations, training courses, professional memberships mentioned",
  "heroTreatments": "main featured treatments comma-separated",
  "treatmentsJson": ["use ONLY these keys: antiWrinkle1,antiWrinkle2,antiWrinkle3,fillerLips,fillerCheeks,fillerJaw,fillerNose,fillerHands,skinBooster,prp,mesotherapy,microneedling,chemicalPeel,hydrafacial,ipl,laserHairRemoval,cryolipolysis,hifu,dermaplaning,vitaminDrip,profhilo,polynucleotides,blepharoplasty,threadLift,fatDissolver,skinTag,mole,botulinum"],
  "pricingJson": {"treatmentKey": priceAsInteger — only for explicitly stated prices},
  "postingFrequency": "daily | few-per-week | weekly | few-per-month | monthly | rarely | unknown",
  "contentQualityScore": 3,
  "reviewSentimentSummary": "1-2 sentences summarising review themes if reviews are mentioned",
  "commonPraiseJson": ["themes mentioned as positives in reviews or testimonials"],
  "commonComplaintsJson": ["themes mentioned as negatives or complaints"],
  "strengthsJson": ["visible competitive strengths — be specific"],
  "weaknessesJson": ["apparent weaknesses or gaps — be specific"],
  "notes": "any other useful intelligence",
  "sourceLinks": "${sources.join(", ")}",
  "confidenceLevel": "Verified"
}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content || "{}";
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw); } catch { data = {}; }

  // ── Post-GPT: Geocode GPT-extracted address if we still have no coordinates ─
  if (!lat) {
    const gpAddr = (data.address as string || "").trim();
    if (gpAddr && gpAddr.length > 5) {
      try {
        const nominatim = await fetchPage(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(gpAddr + ", UK")}&format=json&limit=1`,
          5000
        );
        if (nominatim.ok && nominatim.html.trim().startsWith("[")) {
          const parsed = JSON.parse(nominatim.html.trim())[0];
          if (parsed?.lat) { lat = parsed.lat; lng = parsed.lon; }
        }
      } catch { /* non-fatal */ }
    }
  }

  // Calculate Haversine distance once we have coords (from any source)
  if (lat && lng && !distanceMiles) {
    const dist = haversineDistance(parseFloat(lat), parseFloat(lng), APA_LAT, APA_LNG);
    distanceMiles = dist.toFixed(1);
  }

  // Override GPT values with hard-extracted / calculated ones
  if (googleRating) data.googleRating = googleRating;
  if (googleReviewCount) data.googleReviewCount = googleReviewCount;
  if (igFollowers > 0) data.instagramFollowers = igFollowers;
  if (igHandle) data.instagram = igHandle;
  if (lat) data.lat = lat;
  if (lng) data.lng = lng;
  if (distanceMiles) data.distanceMiles = distanceMiles;

  // If GPT found a googleRating that we didn't hard-extract, keep it (don't blank it)
  const finalRating = googleRating || (data.googleRating as string || "");
  if (finalRating) data.googleRating = finalRating;

  serialiseFields(data);

  return { data, sources, igFollowers, googleRating: finalRating, googleReviewCount, lat, lng, distanceMiles };
}

// ── Property filter helper ─────────────────────────────────────────────────
// When filtering by a property, include competitors tagged to that property
// AND competitors with no property (global/all-property competitors).
function buildWhere(projectId: number, propertyId: number | null) {
  if (propertyId) {
    return and(
      eq(competitorsTable.projectId, projectId),
      or(eq(competitorsTable.propertyId, propertyId), isNull(competitorsTable.propertyId))
    );
  }
  return eq(competitorsTable.projectId, projectId);
}

// ── GET competitors ───────────────────────────────────────────────────────────
router.get("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : null;
  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(buildWhere(projectId, propertyId))
    .orderBy(competitorsTable.createdAt);
  return res.json({ competitors });
});

// ── GET competition summary ───────────────────────────────────────────────────
router.get("/projects/:id/competition-summary", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : null;
  const competitors = await db.select().from(competitorsTable).where(buildWhere(projectId, propertyId));

  if (competitors.length === 0) return res.json({ hasData: false, competitorCount: 0 });

  const scored = competitors.map(c => {
    const dist = parseFloat(c.distanceMiles || "5") || 5;
    const proxScore = dist <= 0.5 ? 88 : dist <= 1 ? 76 : dist <= 2 ? 62 : dist <= 3 ? 48 : 32;
    const rating = parseFloat(c.googleRating || "0") || 0;
    const reviewScore = Math.min((rating / 5) * 60 + Math.min((c.googleReviewCount || 0) / 300, 1) * 40, 100);
    const score = Math.round(proxScore * 0.15 + (c.clinicalAuthorityScore || 50) * 0.15 + reviewScore * 0.15 + (c.brandStrengthScore || 50) * 0.15 + (c.premisesStrengthScore || 50) * 0.10 + Math.min((c.instagramFollowers || 0) / 5000, 1) * 100 * 0.05 + 50 * 0.25);
    return { ...c, threatScore: score };
  }).sort((a, b) => b.threatScore - a.threatScore);

  const highThreatCount = scored.filter(c => c.threatScore >= 68).length;
  const topThreat = scored[0];
  const nurseLedIP = competitors.filter(c => c.clinicType === "nurse-led" && c.independentPrescriber).length;
  const saturation = nurseLedIP / Math.max(competitors.length, 1);
  const marketSpaceScore = Math.round(Math.max(25, Math.min(90, (1 - saturation * 0.6) * 75 + 15)));
  const ratedComps = competitors.filter(c => parseFloat(c.googleRating || "0") > 0);
  const avgCompRating = ratedComps.length ? Math.round((ratedComps.reduce((s, c) => s + parseFloat(c.googleRating || "0"), 0) / ratedComps.length) * 10) / 10 : null;

  return res.json({
    hasData: true,
    competitorCount: competitors.length,
    highThreatCount,
    topThreat: topThreat ? { name: topThreat.name, score: topThreat.threatScore, clinicType: topThreat.clinicType, distanceMiles: topThreat.distanceMiles } : null,
    marketSpaceScore,
    avgCompRating,
  });
});

// ── POST create competitor ─────────────────────────────────────────────────
router.post("/projects/:id/competitors", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const [created] = await db
    .insert(competitorsTable)
    .values({ ...req.body, projectId, updatedAt: new Date() })
    .returning();
  return res.json({ competitor: created });
});

// ── PUT update competitor ──────────────────────────────────────────────────
router.put("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  const [updated] = await db
    .update(competitorsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)))
    .returning();
  return res.json({ competitor: updated });
});

// ── DELETE competitor ──────────────────────────────────────────────────────
router.delete("/projects/:id/competitors/:cid", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);
  await db
    .delete(competitorsTable)
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)));
  return res.json({ ok: true });
});

// ── POST URL / Instagram lookup (for new competitor form) ─────────────────
router.post("/projects/:id/competitors/lookup", async (req, res) => {
  let { url } = req.body as { url: string };
  if (!url?.trim()) return res.status(400).json({ error: "URL required" });

  // Normalise
  const igHandleOnly = url.match(/^@?([\w.]+)$/);
  if (igHandleOnly && !url.includes(".")) {
    url = `https://www.instagram.com/${igHandleOnly[1]}/`;
  } else if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  try {
    const result = await runLookup(url);
    return res.json({
      data: result.data,
      sources: result.sources,
      sourceCount: result.sources.length,
      googleRating: result.googleRating,
      googleReviewCount: result.googleReviewCount,
      igFollowers: result.igFollowers,
      lat: result.lat,
      lng: result.lng,
      distanceMiles: result.distanceMiles,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg.slice(0, 200) });
  }
});

// ── GET competitor-driven APA pricing strategy ────────────────────────────
router.get("/projects/:id/competitors/pricing-strategy", async (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

  const allCompetitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId));
  if (allCompetitors.length === 0) return res.json({ competitorCount: 0, competitorsWithPricing: 0, launchPricing: {}, maturePricing: {}, launchAcv: null, matureAcv: null, strategy: null });

  // Treatment keys APA uses — GPT must return prices using these exact keys
  const TREATMENT_KEY_MAP: Record<string, string[]> = {
    antiWrinkle1: ["Anti-wrinkle 1 area","Anti-wrinkle (1 area)","1 area","botox 1 area","antiwrinkle 1"],
    antiWrinkle2: ["Anti-wrinkle 2 areas","Anti-wrinkle (2 areas)","2 areas","botox 2 areas"],
    antiWrinkle3: ["Anti-wrinkle 3 areas","Anti-wrinkle (3 areas)","3 areas","botox 3 areas"],
    lipFiller05:  ["Lip filler 0.5ml","lip filler 0.5","0.5ml lip","half ml lip"],
    lipFiller1:   ["Lip filler 1ml","lip filler 1","1ml lip","full lip"],
    cheekFiller:  ["Cheek filler 1ml","cheek filler","cheek augmentation","cheeks 1ml"],
    jawChin:      ["Jaw/chin filler","jaw filler","chin filler","jaw and chin"],
    tearTrough:   ["Tear trough","tear trough filler","under eye filler"],
    skinBooster:  ["Skin booster","skin boosters","juvederm volite","teosyal redensity"],
    profhilo:     ["Profhilo (course of 2)","Profhilo","profhilo 2 sessions","profhilo course"],
    polynucleotides: ["Polynucleotides","PDRN","PDRN treatment","PN treatment"],
    microneedling: ["Microneedling","dermapen","skin needling"],
    chemicalPeel: ["Chemical peel","peel","skin peel"],
  };

  // Aggregate competitor pricing: normalise keys → TREATMENT_KEY_MAP, collect all prices
  const aggregated: Record<string, { prices: number[]; clinics: string[] }> = {};
  let competitorsWithPricing = 0;

  for (const comp of allCompetitors) {
    if (!comp.pricingJson || comp.pricingJson === "{}") continue;
    let pricing: Record<string, number> = {};
    try { pricing = JSON.parse(comp.pricingJson); } catch { continue; }
    if (Object.keys(pricing).length === 0) continue;
    competitorsWithPricing++;

    for (const [rawKey, price] of Object.entries(pricing)) {
      if (!price || price <= 0) continue;
      // Find which canonical key this raw key maps to
      const canonical = Object.entries(TREATMENT_KEY_MAP).find(([, aliases]) =>
        aliases.some(a => rawKey.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(rawKey.toLowerCase()))
      )?.[0] ?? rawKey.toLowerCase().replace(/\s+/g, "_");

      if (!aggregated[canonical]) aggregated[canonical] = { prices: [], clinics: [] };
      aggregated[canonical].prices.push(price);
      aggregated[canonical].clinics.push(comp.name ?? "Unknown");
    }
  }

  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };

  // Build rich per-competitor profile blocks with pricing alongside positioning
  const COMPARABLE_CLINIC_TYPES = new Set(["nurse-led","doctor-led","dentist-led","mixed practitioner","injectables-only"]);
  const COMPARABLE_PREMISES = new Set(["high street shopfront","medical clinic","dental clinic","destination clinic"]);

  const competitorBlocks = allCompetitors.slice(0, 16).map(c => {
    const isComparableClinician = COMPARABLE_CLINIC_TYPES.has(c.clinicType ?? "");
    const isComparablePremises  = COMPARABLE_PREMISES.has(c.premisesType ?? "");
    const isDirectComp = isComparableClinician && isComparablePremises;
    const isMedical    = isComparableClinician;

    const qualBadges: string[] = [];
    if (c.saveFace)               qualBadges.push("Save Face accredited");
    if (c.independentPrescriber)  qualBadges.push("independent prescriber");
    if (c.jccp)                   qualBadges.push("JCCP registered");
    if (c.nhsBackground)          qualBadges.push("NHS background");

    const pricingData: Record<string, number> = {};
    try { Object.assign(pricingData, JSON.parse(c.pricingJson || "{}")); } catch { /* skip */ }
    const hasPricing = Object.keys(pricingData).length > 0;

    const pricingLines = hasPricing
      ? Object.entries(pricingData)
          .filter(([,v]) => v > 0)
          .map(([k, v]) => `    ${k}: £${v}`)
          .join("\n")
      : "    (no pricing data entered)";

    const comparabilityNote = isDirectComp
      ? "⭐ DIRECT COMPARABLE — same clinical tier and premises type as APA. Use this pricing to anchor APA's positioning."
      : !isMedical
        ? "⚠️ NOT A DIRECT COMPARABLE — non-medical/beauty practitioner. Their lower prices reflect a fundamentally different (and lower-credibility) market segment. Do NOT use their prices to drag APA's recommendations down."
        : "~ PARTIAL COMPARABLE — medical clinician but different premises type. Factor in but weight less than high-street medical comparables.";

    return [
      `• ${c.name}`,
      `  Clinic type: ${c.clinicType ?? "unknown"} | Premises: ${c.premisesType ?? "unknown"} | Distance: ${c.distanceMiles ? c.distanceMiles + " miles" : "unknown"}`,
      `  Positioning: ${c.positioningCategory ?? "unknown"} | Threat score: ${c.estimatedThreatScore ?? "??"}/100`,
      qualBadges.length ? `  Qualifications/accreditations: ${qualBadges.join(", ")}` : `  Qualifications: none recorded`,
      `  ${comparabilityNote}`,
      `  Pricing:`,
      pricingLines,
    ].join("\n");
  }).join("\n\n");

  // Separate summary of comparable-only prices for anchor reference
  const comparablePrices: Record<string, number[]> = {};
  for (const comp of allCompetitors) {
    const isComp = COMPARABLE_CLINIC_TYPES.has(comp.clinicType ?? "") && COMPARABLE_PREMISES.has(comp.premisesType ?? "");
    if (!isComp || !comp.pricingJson || comp.pricingJson === "{}") continue;
    let p: Record<string, number> = {};
    try { p = JSON.parse(comp.pricingJson); } catch { continue; }
    for (const [k, v] of Object.entries(p)) {
      if (v > 0) {
        if (!comparablePrices[k]) comparablePrices[k] = [];
        comparablePrices[k].push(v);
      }
    }
  }
  const comparableSummary = Object.entries(comparablePrices).length > 0
    ? Object.entries(comparablePrices).map(([k, prices]) => {
        const s = [...prices].sort((a,b) => a-b);
        return `  ${k}: £${s[0]}–£${s[s.length-1]} (median £${median(s)}, ${prices.length} direct comparable${prices.length!==1?"s":""})`;
      }).join("\n")
    : "  No direct comparable clinics have pricing data yet — use wider market knowledge for Winchester.";

  const prompt = `You are a pricing strategist for UK private aesthetics clinics. Your client is Abi Peters Aesthetics (APA) — a premium nurse-led (ANP) clinic opening in Winchester city centre in November 2026. Winchester is an affluent market (ABC1 demographic, strong professional female spending power).

APA positioning: natural-results nurse-led clinic, Save Face accredited, independent prescriber, 12+ years NHS and aesthetics experience, high street shopfront in Winchester city centre.

═══════════════════════════════════════════════
COMPETITOR LANDSCAPE — FULL PROFILES (${allCompetitors.length} competitors mapped)
═══════════════════════════════════════════════
${competitorBlocks || "No competitors mapped yet."}

═══════════════════════════════════════════════
DIRECT-COMPARABLE PRICE ANCHORS (medical clinicians in comparable premises only)
═══════════════════════════════════════════════
${comparableSummary}

CRITICAL PRICING RULES:
- Competitors marked ⚠️ NOT A DIRECT COMPARABLE are beauty/non-medical practitioners. Their prices are irrelevant for anchoring APA's pricing — APA's target clients are choosing between nurse-led and doctor-led medical clinics, not beauty salons. Do not let their low prices pull APA recommendations down.
- Competitors marked ⭐ DIRECT COMPARABLE are the true anchors for APA's pricing — these are the clinics APA's clients will cross-shop with.
- If the only pricing data available is from non-comparable competitors, rely on your knowledge of Winchester/Hampshire nurse-led/doctor-led clinic market rates and state this in the strategy.
- APA is nurse-led premium, not budget. It should never price below mid-market for a medical aesthetics clinic.
- Winchester has high disposable income — premium pricing is achievable once established.

Your task: recommend APA's pricing strategy in TWO phases:

1. LAUNCH PRICING (November 2026): Realistic opening prices that are competitive relative to DIRECT COMPARABLE medical clinics only. Can be 5-10% below mature prices to acknowledge APA has no reviews yet, but must not undercut to the point of devaluing the brand.

2. MATURE PRICING (12+ months post-launch): Prices APA should target once established with reviews and a client base. Should fully reflect APA's premium nurse-led positioning against the direct comparable medical clinic market.

Return ONLY valid JSON:
{
  "launchPricing": {
    "antiWrinkle1": integer_or_null,
    "antiWrinkle2": integer_or_null,
    "antiWrinkle3": integer_or_null,
    "lipFiller05": integer_or_null,
    "lipFiller1": integer_or_null,
    "cheekFiller": integer_or_null,
    "jawChin": integer_or_null,
    "tearTrough": integer_or_null,
    "skinBooster": integer_or_null,
    "profhilo": integer_or_null,
    "polynucleotides": integer_or_null,
    "microneedling": integer_or_null,
    "chemicalPeel": integer_or_null
  },
  "maturePricing": {
    "antiWrinkle1": integer_or_null,
    "antiWrinkle2": integer_or_null,
    "antiWrinkle3": integer_or_null,
    "lipFiller05": integer_or_null,
    "lipFiller1": integer_or_null,
    "cheekFiller": integer_or_null,
    "jawChin": integer_or_null,
    "tearTrough": integer_or_null,
    "skinBooster": integer_or_null,
    "profhilo": integer_or_null,
    "polynucleotides": integer_or_null,
    "microneedling": integer_or_null,
    "chemicalPeel": integer_or_null
  },
  "launchAcv": integer,
  "matureAcv": integer,
  "marketMedians": {
    "antiWrinkle1": integer_or_null,
    "lipFiller1": integer_or_null,
    "profhilo": integer_or_null
  },
  "strategy": "3-4 sentences: overall pricing strategy rationale — reference actual competitor prices, explain the launch vs mature split, and what pricing signals APA's premium positioning without pricing itself out.",
  "launchRationale": "2 sentences: why these specific launch prices — what competitive logic drives them.",
  "matureRationale": "2 sentences: why the 12m+ prices move up and what has to happen for APA to justify that increase.",
  "pricingTier": "one of: budget | mid-market | premium | ultra-premium",
  "keyRisk": "1 sentence: biggest pricing risk APA faces in this market."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        { role: "system", content: "You are a specialist pricing strategist for UK private aesthetics clinics. Return only valid JSON. Be precise and ground recommendations in the provided competitor data." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content || "{}";
    let result: Record<string, unknown> = {};
    try { result = JSON.parse(raw); } catch { /* fall through */ }

    return res.json({
      ...result,
      competitorCount: allCompetitors.length,
      competitorsWithPricing,
      marketData: Object.fromEntries(
        Object.entries(aggregated).map(([k, { prices }]) => [k, {
          min: Math.min(...prices), max: Math.max(...prices), median: median(prices), count: prices.length,
        }])
      ),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg.slice(0, 300) });
  }
});

// ── POST tab-specific AI research for competitor modal ────────────────────
router.post("/projects/:id/competitors/tab-research", async (req, res) => {
  const {
    name,
    website,
    address,
    instagram,
    tab,
    existingData = {},
  } = req.body as {
    name?: string;
    website?: string;
    address?: string;
    instagram?: string;
    tab: number;
    existingData?: Record<string, unknown>;
  };

  if (!name?.trim() && !website?.trim()) {
    return res.status(400).json({ error: "Provide at least a competitor name or website." });
  }

  // Fetch website HTML for context — best-effort, non-blocking
  let htmlContext = "";
  if (website) {
    const pageResult = await fetchPage(website, 8000);
    if (pageResult.ok && pageResult.html.length > 500) {
      const stripped = pageResult.html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{3,}/g, " ")
        .slice(0, 8000);
      htmlContext = `\n\nWebsite content (extracted):\n${stripped}`;
    }
  }

  const competitorContext = [
    name    && `Clinic name: ${name}`,
    website && `Website: ${website}`,
    address && `Address: ${address}`,
    instagram && `Instagram: @${instagram.replace("@", "")}`,
  ].filter(Boolean).join("\n");

  const existingContext = Object.keys(existingData).length > 0
    ? `\nAlready known:\n${Object.entries(existingData)
        .filter(([, v]) => v !== null && v !== "" && v !== 0 && v !== false && v !== "unknown" && v !== "Unclear")
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join("\n")}`
    : "";

  const positioningHint = (existingData.positioningCategory as string) || "unknown — infer from clinic type and location";

  const TAB_CONFIGS: Record<number, { title: string; instructions: string; schema: string }> = {
    0: {
      title: "Identity & Contact Details",
      instructions: `Research this aesthetics clinic's identity and contact details. Use your training knowledge of UK aesthetics clinics, Google Business profiles, and social media.

Find or confirm: official clinic/practitioner name, full postal address, UK phone number, Instagram handle, Google rating (as a string like "4.8"), total Google review count, Instagram follower count, distance in miles from Winchester city centre (9A Jewry Street, SO23 8RY), and any booking platform URL (Fresha, Timely, Ovatu, etc).

Be specific — give actual numbers where you know them. If estimating, note it in the summary.`,
      schema: `{
  "name": "string or null",
  "address": "full UK postal address or null",
  "phone": "UK phone number or null",
  "instagram": "instagram handle WITHOUT @ symbol, or null",
  "website": "full URL or null",
  "bookingLink": "booking platform URL if known, or null",
  "googleRating": "e.g. '4.8' as string, or null",
  "googleReviewCount": integer_or_null,
  "instagramFollowers": integer_or_null,
  "distanceMiles": "miles from Winchester as string e.g. '1.2', or null",
  "summary": "2-3 sentences: what you found, confidence level, and any important caveats."
}`,
    },
    1: {
      title: "Clinic Profile & Credentials",
      instructions: `Research this aesthetics clinic's professional credentials, clinic type, and market positioning. Be objective — this is competitor intelligence, not a marketing summary.

Determine: type of practitioner (nurse, doctor, dentist, beautician, unknown), NHS/medical background, any explicit accreditations (Save Face = savefaceaccredited.co.uk, JCCP = jccp.org.uk), whether they are an independent prescriber, premises type, how they position themselves, hero treatments, and who their target client is.

Critical rule: only mark saveFace=true or jccp=true if explicitly stated on their website or official directories — never assume.`,
      schema: `{
  "clinicType": "nurse-led | doctor-led | dentist-led | beautician-led | mixed practitioner | laser/skin specialist | injectables-only | salon-led aesthetics | chain/brand clinic | unknown",
  "premisesType": "high street shopfront | medical clinic | rented room | beauty salon room | home clinic | dental clinic | chain clinic | destination clinic | unknown",
  "positioningCategory": "luxury medical clinic | natural-results nurse-led clinic | doctor-led premium clinic | beauty salon aesthetics | budget injector | skin/laser specialist | holistic wellness clinic | chain clinic | home-based trusted local | social-media-led injector",
  "practitionerType": "e.g. 'RGN, 6 years aesthetics experience' or null",
  "targetAudience": "e.g. '30s-50s professional females in Hampshire' or null",
  "yearsExperience": integer_or_null,
  "saveFace": boolean,
  "jccp": boolean,
  "independentPrescriber": boolean,
  "nhsBackground": boolean,
  "heroTreatments": "comma-separated top 3-5 signature treatments",
  "credentialsNotes": "honest 2-3 sentence assessment of their clinical credentials and authority",
  "summary": "3-4 sentences: professional profile, positioning, what makes them credible or not as a competitor to a new premium Winchester nurse-led clinic."
}`,
    },
    2: {
      title: "Reviews & Social Media Presence",
      instructions: `Research this aesthetics clinic's online reputation and social media activity. You are a neutral analyst — do not soften negative findings.

Investigate: Google review sentiment (what do reviewers praise, what do they complain about?), Instagram posting frequency (daily / several per week / weekly / fortnightly / monthly / rarely), content quality (1=very poor to 5=professional and consistent), use of before/after imagery, and overall trust reputation.

If you have specific knowledge of this clinic from your training, use it. If not, make evidence-based inferences from their positioning and type — but flag clearly that you are estimating. Give real, actionable insight — not generic statements.`,
      schema: `{
  "googleReviewCount": integer_or_null,
  "reviewSentimentSummary": "honest 2-3 sentence summary of what their Google reviews say — common praise, complaints, overall tone. Be specific.",
  "commonPraiseJson": ["most common praise theme", "second most common", "third"],
  "commonComplaintsJson": ["most common complaint", "second if applicable"],
  "postingFrequency": "daily | several per week | weekly | fortnightly | monthly | rarely | unknown",
  "contentQualityScore": integer_1_to_5,
  "beforeAfterUse": boolean,
  "summary": "3-4 sentences covering: overall reputation strength, what reviewers say, social media presence quality, and how their online authority compares to what a new clinic needs to compete with them."
}`,
    },
    3: {
      title: "Pricing & Treatment Menu",
      instructions: `Research this clinic's treatment pricing and menu. Use any prices visible in the website content. If prices are not visible, estimate based on their positioning, clinic type, and local market context — but label estimates clearly.

UK market context for anti-wrinkle (per area): budget = £100-150, mid-market = £150-200, premium = £200-300+. Their positioning: ${positioningHint}.

Cover at minimum: anti-wrinkle 1/2/3 areas, lip filler 0.5ml and 1ml, cheek filler 1ml, Profhilo (course of 2), tear trough. Add any other treatments they clearly promote.`,
      schema: `{
  "pricingJson": {
    "Anti-wrinkle 1 area": integer_or_null,
    "Anti-wrinkle 2 areas": integer_or_null,
    "Anti-wrinkle 3 areas": integer_or_null,
    "Lip filler 0.5ml": integer_or_null,
    "Lip filler 1ml": integer_or_null,
    "Cheek filler 1ml": integer_or_null,
    "Profhilo (course of 2)": integer_or_null,
    "Tear trough": integer_or_null
  },
  "treatmentsJson": ["full list of treatments they offer"],
  "heroTreatments": "comma-separated top 3-5 most promoted treatments",
  "summary": "3-4 sentences: pricing strategy (premium/mid/budget), specific price comparisons vs Winchester market rates, whether they compete on price or value, and what this means for a new premium clinic competing against them."
}`,
    },
    4: {
      title: "Competitive Threat Analysis",
      instructions: `Conduct a rigorous, honest competitive analysis of this aesthetics clinic from the perspective of a new premium nurse-led clinic (Abi Peters Aesthetics) opening in Winchester city centre in November 2026. Do NOT be generous — give Abi an accurate threat assessment.

Score 0-100 where 100 = strongest possible competitor:
- Clinical Authority Score: clinical credibility, qualifications, medical depth
- Trust Score: online reputation, review volume, accreditations, longevity  
- Brand Strength Score: visual brand quality, consistency, marketing professionalism
- Premises Strength Score: physical space quality, location prominence, clinic environment

Estimated Threat Score (0-100): holistic competitive threat. 80+ = serious threat requiring direct differentiation strategy. 50-79 = moderate, manageable with positioning. Below 50 = limited threat.

Identify specific strengths and genuine weaknesses — vague answers are useless.`,
      schema: `{
  "estimatedThreatScore": integer_0_to_100,
  "threatReason": "honest, specific 2-sentence assessment of the competitive threat — do not soften. What specifically makes them dangerous or manageable as competition?",
  "clinicalAuthorityScore": integer_0_to_100,
  "trustScore": integer_0_to_100,
  "brandStrengthScore": integer_0_to_100,
  "premisesStrengthScore": integer_0_to_100,
  "strengthsJson": ["specific strength with supporting evidence", "second strength", "third strength"],
  "weaknessesJson": ["specific exploitable weakness", "second weakness", "third weakness"],
  "summary": "4-5 sentences: overall competitive assessment, their biggest advantages over a new entrant, their most exploitable vulnerabilities, and the single most important strategic response the new clinic must make to compete effectively."
}`,
    },
    5: {
      title: "Data Quality & Confidence Assessment",
      instructions: `Assess the quality and reliability of the competitor intelligence available for this clinic. Be honest about what is confirmed vs. estimated vs. genuinely unknown.

Consider: how findable is this clinic online? Website quality? Consistency across Google/Instagram/directories? How current is the data? What are the critical gaps Abi must fill herself through manual research?`,
      schema: `{
  "confidenceLevel": "Confirmed | Likely | Unclear | Not found",
  "sourceLinks": "comma-separated specific URLs where data exists (website, Google Maps URL, Instagram, etc.)",
  "notes": "honest 3-4 sentence assessment: what is well-confirmed, what is estimated, what are the critical intelligence gaps, and what Abi should verify manually before relying on this data.",
  "summary": "2-3 sentences on overall data reliability and what is most important to verify independently."
}`,
    },
  };

  const tabConfig = TAB_CONFIGS[tab];
  if (!tabConfig) return res.status(400).json({ error: `Unknown tab: ${tab}` });

  const systemPrompt = `You are a specialist competitive intelligence analyst for UK aesthetics and medical aesthetics clinics. You have deep knowledge of the UK aesthetics market: clinic business models, typical pricing by positioning tier, standard professional credentials (Save Face, JCCP, RGN, ANP, independent prescribing), online marketing patterns, and local competitive dynamics in Hampshire and the South East.

Your client is Abi Peters, an Advanced Nurse Practitioner launching a premium aesthetics clinic in Winchester city centre (November 2026). You are researching her competitors. Your job is to give Abi honest, specific, actionable intelligence — not reassuring generalities. Do not soften competitive threats. Do not be vague.

Rules:
- If you know something with confidence from your training data, state it directly
- If you are estimating, say "estimated" or "likely" in the summary
- If you genuinely don't know, return null for that field — never fabricate specific facts
- Always populate the "summary" field with a substantive, specific paragraph that would actually be useful to someone making a business decision
- Return ONLY valid JSON. No markdown, no text outside the JSON object.`;

  const userMessage = `Research task: ${tabConfig.title}

Competitor:
${competitorContext}${existingContext}${htmlContext}

Instructions:
${tabConfig.instructions}

Return this JSON schema exactly (null for genuinely unknown fields):
${tabConfig.schema}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15,
    });

    const raw = completion.choices[0].message.content || "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { /* fall through */ }

    const summary = (parsed.summary as string) || null;
    delete parsed.summary;

    // Normalise values: arrays → JSON strings, null strings → skip, pricing objects → JSON strings
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && (v === "null" || v.trim() === "" || v === "unknown" || v === "Unclear")) continue;
      if (Array.isArray(v)) {
        const arr = (v as unknown[]).filter(Boolean);
        if (arr.length > 0) clean[k] = JSON.stringify(arr);
        continue;
      }
      if (k === "pricingJson" && typeof v === "object" && !Array.isArray(v)) {
        const pricing: Record<string, number> = {};
        for (const [t, p] of Object.entries(v as Record<string, unknown>)) {
          const num = typeof p === "number" ? p : parseInt(String(p));
          if (!isNaN(num) && num > 0) pricing[t] = num;
        }
        if (Object.keys(pricing).length > 0) clean[k] = JSON.stringify(pricing);
        continue;
      }
      clean[k] = v;
    }

    return res.json({ data: clean, summary, fieldsFound: Object.keys(clean).length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg.slice(0, 300) });
  }
});

// ── POST enrich existing competitor ───────────────────────────────────────
router.post("/projects/:id/competitors/:cid/enrich", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const cid = parseInt(req.params.cid);

  const [existing] = await db
    .select()
    .from(competitorsTable)
    .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)));

  if (!existing) return res.status(404).json({ error: "Competitor not found" });

  const lookupUrl = existing.website
    || (existing.instagram ? `https://www.instagram.com/${existing.instagram}/` : "");

  if (!lookupUrl) {
    return res.status(400).json({ error: "No website or Instagram stored for this competitor — add one first then enrich." });
  }

  try {
    const result = await runLookup(lookupUrl);
    const enriched = result.data;

    // Only overwrite fields that were actually found (non-empty/non-default)
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(enriched)) {
      if (v !== null && v !== "" && v !== 0 && v !== false && v !== "[]" && v !== "{}" && v !== "unknown" && v !== "Unclear") {
        updates[k] = v;
      }
    }
    updates.lastChecked = new Date().toISOString().split("T")[0];
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(competitorsTable)
      .set(updates)
      .where(and(eq(competitorsTable.id, cid), eq(competitorsTable.projectId, projectId)))
      .returning();

    return res.json({
      competitor: updated,
      sources: result.sources,
      fieldsUpdated: Object.keys(updates).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg.slice(0, 200) });
  }
});

// ── POST AI competitor search ──────────────────────────────────────────────
router.post("/projects/:id/competitors/ai-search", async (req, res) => {
  const { location = "9A Jewry Street, Winchester, Hampshire, UK", radiusMiles = 5 } = req.body;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content: `You are a neutral, independent market intelligence analyst. You have no affiliation with any clinic, brand, or business. Your sole job is to provide objective, honest competitor intelligence to help a business owner understand the real competitive landscape before launching. You must not downplay, soften, or overlook genuine threats. You must not favour any particular clinic or assume any clinic has advantages it has not clearly demonstrated. If a competitor is a serious threat — say so clearly. If you genuinely don't know about specific businesses in this area, be honest about that limitation rather than fabricating data.`,
      },
      {
        role: "user",
        content: `Search your knowledge for all aesthetics clinics, nurse injectors, medical aesthetics practitioners, skin clinics, laser clinics, beauty salons offering injectables, dental clinics offering aesthetics, and home-based injectors operating within approximately ${radiusMiles} miles of ${location}.

Return a JSON object:
{
  "competitors": [
    {
      "name": "clinic or practitioner name",
      "address": "full address if known, else 'Address not confirmed'",
      "distanceMiles": "estimated distance as string e.g. '0.4'",
      "website": "URL if known, else ''",
      "clinicType": "one of: nurse-led | doctor-led | dentist-led | beautician-led | mixed practitioner | laser/skin specialist | injectables-only | salon-led aesthetics | chain/brand clinic | unknown",
      "premisesType": "one of: high street shopfront | medical clinic | rented room | beauty salon room | home clinic | dental clinic | chain clinic | destination clinic | unknown",
      "positioningCategory": "one of: luxury medical clinic | natural-results nurse-led clinic | doctor-led premium clinic | beauty salon aesthetics | budget injector | skin/laser specialist | holistic wellness clinic | chain clinic | home-based trusted local | social-media-led injector",
      "estimatedThreatScore": integer 0-100,
      "threatReason": "honest 1-2 sentence objective assessment of the competitive threat they pose — do not soften this",
      "heroTreatments": "main treatments comma-separated",
      "saveFace": false,
      "independentPrescriber": false,
      "instagramFollowers": 0,
      "googleRating": "",
      "googleReviewCount": 0,
      "confidenceLevel": "Likely | Unclear | Not found",
      "importantNote": "key caveat about this entry — e.g. data from training set, should be independently verified",
      "treatmentFocus": "injectables | laser/skin | full-service | skincare"
    }
  ],
  "marketNote": "1-2 honest sentences about overall competition intensity in this area — do not be optimistic unless the data warrants it",
  "dataWarning": "brief note about the limitations of AI-generated competitor data"
}

Rank by estimatedThreatScore highest first. Include ALL types of competition — chains, dental clinics, well-reviewed local clinics, and home-based injectors are all genuine competition. Do not exclude competitors because they are 'different' in positioning.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = completion.choices[0].message.content || "{}";
  let result: { competitors?: unknown[]; marketNote?: string; dataWarning?: string } = {};
  try { result = JSON.parse(raw); } catch { result = {}; }

  const sorted = ((result.competitors || []) as Record<string, unknown>[])
    .sort((a, b) => ((b.estimatedThreatScore as number) || 0) - ((a.estimatedThreatScore as number) || 0));

  return res.json({
    competitors: sorted,
    marketNote: result.marketNote || "",
    dataWarning: result.dataWarning || "",
    disclaimer: "This list is generated from AI training data and may be incomplete, outdated, or contain inaccuracies. It is a starting point for research only — every entry must be independently verified before making any business decision. This is not a live internet search.",
    generatedAt: new Date().toISOString(),
    location,
    radiusMiles,
  });
});

export default router;
