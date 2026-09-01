// Stored pricing strategy for Abi Peters Skin Clinic, built from live competitor
// price verification on 31 August 2026 (competitor-pricing-refresh workflow).
// The pricing-strategy endpoint serves this instantly; pass ?ai=1 to regenerate via AI.
export type StoredStrategy = {
  verifiedAt: string;
  launchPricing: Record<string, number>;
  maturePricing: Record<string, number>;
  launchAcv: number;
  matureAcv: number;
  strategy: string;
  launchRationale: string;
  matureRationale: string;
  pricingTier: string;
  keyRisk: string;
  acvMix: string;
  perTreatment: Record<string, string>;
  architecture: { h: string; b: string }[];
  competitiveRead: { name: string; read: string }[];
  risks: string[];
} | null;

export const STORED_STRATEGY: StoredStrategy = {
 "verifiedAt": "2026-08-31",
 "launchPricing": {
   "antiWrinkle1": 190,
   "antiWrinkle2": 255,
   "antiWrinkle3": 305,
   "lipFiller05": 180,
   "lipFiller1": 300,
   "cheekFiller": 300,
   "jawChin": 300,
   "tearTrough": 430,
   "skinBooster": 275,
   "profhilo": 550,
   "polynucleotides": 280,
   "microneedling": 215,
   "chemicalPeel": 90
 },
 "maturePricing": {
   "antiWrinkle1": 210,
   "antiWrinkle2": 280,
   "antiWrinkle3": 330,
   "lipFiller05": 200,
   "lipFiller1": 330,
   "cheekFiller": 330,
   "jawChin": 330,
   "tearTrough": 460,
   "skinBooster": 295,
   "profhilo": 590,
   "polynucleotides": 300,
   "microneedling": 235,
   "chemicalPeel": 100
 },
 "launchAcv": 250,
 "matureAcv": 275,
 "strategy": "The authoritative pricing now lives in the Market and Pricing page, computed against the verified two-catchment dataset. The rule: 4 percent below the 20km medical median, VAT inclusive, no percentage discounts anywhere, POM treatments never in public offers. Winchester anti-wrinkle 190, 255, 305; filler 300 per ml; tear trough 430; Profhilo face 300 (course of 2, 550); polynucleotides 280; microneedling 215. Bedhampton priced lower per line as the harvest site. Founding mechanics: 40 founder places, quantity-limited, nothing on POMs, no percentages in public copy. Membership ladder: Skin Circle 19, The Skin Plan 115 Winchester (founder 95) and 85 Bedhampton, Advanced 185, Frown Free Club private only.",
 "launchRationale": "Owner-final list, effective from the 2 November 2026 opening: priced 4 percent below the 20km medical median per line (verified in the Market and Pricing page), except 2ml filler (cost-based, median distorted by one premium outlier) and Profhilo (fixed national price, held at 300). These are the Founding prices. The full authoritative per-site list lives in Market and Pricing.",
 "matureRationale": "Mature prices are the planned spring 2027 review, moved to on triggers (80 percent diary utilisation for two weeks plus 25 reviews at 4.9). Founding clients keep launch pricing, which is the founding value story. Any change is made in the treatments table in Market and Pricing first, then reflected here.",
 "pricingTier": "premium",
 "keyRisk": "Empty November diary tempts discounting. Guardrail: the pre-agreed slow-week playbook (extra scan slots, value-adds, retail credit windows) is written down before opening, and the no-percentage-off rule is treated as a licence condition, not a preference.",
 "acvMix": "Financial model holds at 230 per visit. The menu supports more per paying visit, but the capped free AI skin analyses occupy diary slots at zero revenue and blending those back in lands close to 230. Revenue per clinical hour is the sharper number and is shown per treatment in Market and Pricing: masseter about 1005 per hour, anti-wrinkle 730 to 765, membership skin work about 190, which is what gates the associate hire.",
 "perTreatment": {
   "antiWrinkle1": "Winchester 190, Bedhampton 165. Four percent below the 20km medical median of 200 (n=5). Bedhampton is the harvest site and prices lower.",
   "antiWrinkle2": "Winchester 255, Bedhampton 200. Median 270 (n=3). The volume workhorse: the step from one area makes upgrading feel rational.",
   "antiWrinkle3": "Winchester 305, Bedhampton 235. Median 325 (n=4), so a clean four percent under the medical market.",
   "lipFiller05": "Winchester 180, Bedhampton 155. Entry filler line, priced under the doctor-led ceiling of 200.",
   "lipFiller1": "Winchester 300, Bedhampton 200. Median 325 (n=4). Bedhampton at 200 tracks its own catchment median rather than Winchester.",
   "cheekFiller": "Per ml pricing is identical to lips for menu coherence: one clean per-ml rate reads as principled.",
   "jawChin": "Priced per ml in line with cheek and lip. Multi-ml plans are quoted bespoke off the scan, never off this single-ml line.",
   "tearTrough": "New line. Winchester 430, Bedhampton 375, against a thin Winchester median of 500 (n=2, low confidence). The highest-risk area on the menu is where prescriber credentials earn most.",
   "skinBooster": "Skinvive, Winchester 275, Bedhampton 250. A key first-treatment landing spot for scan converts, so it must feel reachable.",
   "profhilo": "Face 300 both sites, held at the fixed national price. Course of 2 at 550 Winchester, 500 Bedhampton. Sold as a course: Profhilo singles are a clinical nonsense and saying so reinforces the honest brand.",
   "polynucleotides": "Winchester 280 against a 300 median (n=5). Bedhampton 225, which sits above its local median of 150 and carries a recorded variance reason.",
   "microneedling": "Face, Winchester 215, Bedhampton 140, against a Winchester median of 250 (n=5). Course of 3 at 580 Winchester.",
   "chemicalPeel": "Obagi Blue Radiance, Winchester 90, Bedhampton 85, against a 95 median (n=3, low confidence). Entry peels are commoditised locally, so this is a funnel line, not a margin line."
 },
 "architecture": [
  {
   "h": "The free AI Skin Analysis is the consultation fee strategy",
   "b": "Winchester's consultation market is soft: Simply Skin and The Medical Aesthetic Clinic are free, Bae charges a nominal 10, Dr Victoria hides the fee, Wessex charges 50. Rather than join the charged-consult debate, APA gives away something with a stated 50 pound value that no competitor owns: a multi-spectral scan with a printed report. The cap in the diary (suggest 6 to 8 slots a week, never more than 20 percent of capacity) is what protects it from becoming a freebie farm: scarcity replaces the fee as the qualification mechanism. Every scan ends with a written treatment plan and a priced next step, and the 40 percent 30-day conversion target should be reviewed weekly from week 3."
  },
  {
   "h": "Deposit and no-show protection",
   "b": "Free scan slots still need skin in the game: take a 30 pound booking deposit on the analysis, returned as credit against any treatment booked within 30 days, forfeited on no-show or late cancellation inside 48 hours. This is not a consultation fee, it is a reservation that converts to money off, so the scan stays honestly free for anyone who turns up. Treatment appointments take a 50 pound deposit deducted on the day (Essenziale now takes 30 percent and Bae takes 50 percent on toxin, so deposits are locally normalised). Prescriber time is the scarcest asset in the business; protect it from day one."
  },
  {
   "h": "Courses are the price list for multi-session treatments",
   "b": "Profhilo, polynucleotides, microneedling and peels are sold as complete protocols with the course as the headline price and the single as the reference price that makes the course look right. Winchester: Profhilo course of 2 at 550 against a 300 single. Polynucleotides course of 3 at 750 against 280 singles. Microneedling course of 3 at 580 against 215 singles. Obagi Blue Radiance peels course of 3 at 245 against 90 singles. The saving is built into the published price, framed as the correct clinical protocol priced properly, never as money off. This also pulls cash forward and locks the second and third visits into the diary, which stabilises a one-nurse capacity model. The authoritative course prices for both sites live in the Market and Pricing page."
  },
  {
   "h": "Founding Client mechanics: quantity-limited, not countdown",
   "b": "The 40 Founding Client places are sold as a named, numbered list, not an offer, and close at 40 places or 31 January 2027 whichever comes first (quantity-limited, never a countdown, to stay clear of ASA pressure-selling rules on cosmetic procedures). Forty is the cap because that is what one nurse can look after. Each place costs nothing to join but requires a completed skin analysis and a booked first treatment. Benefits: a complimentary skin analysis with Abi, a Founder Skin Start (medical facial plus LED at 65 against a 120 list), 50 pounds credit on a second treatment booked within eight weeks, and either the Skin Plan founder rate of 95 or Skin Circle at 15 held for the life of the membership. Launch pricing is protected from the mature list. Nothing on anti-wrinkle treatment, nothing on filler, no percentages in any public copy."
  },
  {
   "h": "The membership ladder: Skin Circle, Skin Plan, Skin Plan Advanced",
   "b": "Three public tiers, treatment-included rather than credit-bank. Skin Circle at 19 a month (both sites): one LED session monthly, 10 percent off retail, priority booking, cancel any time, aimed straight at CJA's 12.50 tier. The Skin Plan at 115 Winchester (founder rate 95, 30 places) and 85 Bedhampton: one 30 minute skin treatment monthly, LED included, a device rescan with written progress notes every fourth month, 15 percent off retail and 10 percent off courses, three-month term, associate-delivered from January 2027. Skin Plan Advanced at 185 (by invitation after four months): adds a quarterly microneedling or exosome session and two full rescans a year with a written plan from Abi. The quarterly rescan with progress notes is the retention engine no competitor can copy, and the ladder undercuts Winchester Medical Aesthetics' 149 founder rate while offering genuine clinical skin progression their facials-only model cannot. The private Frown Free Club sits outside this ladder, enrolled in clinic after a prescribing decision only, and never appears in public copy. The authoritative tiers, face values and revenue per hour live in the Market and Pricing page."
  },
  {
   "h": "The no-discount rule and slow weeks",
   "b": "No percentage off, ever, including Black Friday, which lands 25 days after opening: hold the line publicly, it is the brand. The levers for slow weeks are value-adds and access, not price: release extra capped scan slots to the waitlist, offer founding clients a bring-a-friend scan, add a complimentary LED or dermaplane to bookings made into the quiet week, or open a one-week window for a bonus retail credit with any course purchase. Every lever adds value at known marginal cost and none of them teaches Winchester that APA prices bend. The moment a clinic discounts injectables it becomes Bae, and Bae is closing."
  },
  {
   "h": "Retail skincare attach",
   "b": "Every scan report should end with a prescribed home regime, because the scanner gives objective grounds for it: target a 30 to 35 percent retail attach on treatment visits and 25 pounds average retail per attending client by month three. Stock one medical-grade range, price at RRP with no online undercutting, and fold retail into the membership credit so members buy skincare with banked pounds. Retail is also the honest answer for scan attendees who are not ready for needles: they leave with a plan and a product, not a hard sell, which protects the 40 percent conversion metric from pressure-selling."
  },
  {
   "h": "Moving from launch to mature prices",
   "b": "Trigger, not date: move a line to mature price when the diary for that treatment is at 80 percent for two consecutive weeks and Google reviews pass 25 at 4.9 or better, expected between March and May 2027. Move injectables first, boosters and skin treatments a month later. Announce it plainly 30 days ahead: prices rise on this date, founding members keep their rates until their 12 months are up, book before the date at current prices. That announcement is itself the year's best marketing moment and the proof that the founding promise meant something. Never move a line whose conversion rate from scans is below target; fix the sell first."
  }
 ],
 "competitiveRead": [
  {
   "name": "The Aesthetics Bae",
   "read": "The city budget anchor: confirmed open and busy (5.0 from 204 Fresha reviews) with a heavily promotional posture (sitewide laser offers, filler bundles, summer deals). Never price against them; their promotion-led model is the opposite of APA positioning, and the free scan is the graceful trade-up story for any of their clients wanting a medical setting."
  },
  {
   "name": "Sugar Aesthetics",
   "read": "Domain lapsed, almost certainly gone: their nurse-led clients are unhomed right now, which is a quiet acquisition opportunity for a nurse-led opener; recheck the domain and their Google profile monthly in case of a rebrand."
  },
  {
   "name": "Essenziale Beauty",
   "read": "Salon-led with injectables bolted onto nails and waxing: APA wins on medical credibility, not price, so sit above their 190 toxin and 220 per ml without comment and let the clinical setting do the arguing."
  },
  {
   "name": "Dr Victoria Clinic",
   "read": "The doctor-led ceiling at 400 per ml and 550 tear troughs with a huge device menu: do not chase their price points or their menu breadth, position as the focused, personal, nurse-led alternative that is 15 to 20 percent below them on like-for-like injectables."
  },
  {
   "name": "Shideh Facial Aesthetics",
   "read": "A dentist with a two-year-old PDF price list and a flat 200 per ml on everything including tear troughs: their stale pricing is proof the low end is not where the energy is, and their tear trough rate is a safety talking point, not a competitive threat."
  },
  {
   "name": "Simply Skin Clinic",
   "read": "The closest all-round shadow: free consults, 200 toxin, 300 per ml, 450 tear troughs and a new-client injectable hook; APA should sit 10 to 30 above them per line on the strength of the scanner, the shopfront and prescriber-led care, and watch their offer cycle each season."
  },
  {
   "name": "The Medical Aesthetic Clinic",
   "read": "The nurse-prescriber comparable that legitimises APA's ambitions at 225 toxin and 335 per ml from a Gmail address and a personal mobile: match her prices at maturity with a six-figure clinic, a scanner and online booking behind them, and the value case makes itself."
  },
  {
   "name": "Hampshire Medical",
   "read": "Doctor-led, no fillers at all, settled at 200 toxin and 300 polynucleotides: their gap in fillers is APA's opening in the medical segment, and their new course bundles confirm courses are the local direction of travel."
  },
  {
   "name": "Wessex Skin",
   "read": "Deliberate price opacity with premium floors (210 toxin, 350 filler, 50 consult): their charged consultation makes APA's free capped scan look generous by contrast, so name the contrast in marketing without naming them."
  },
  {
   "name": "Winchester Medical Aesthetics (new entrant)",
   "read": "The real strategic threat: a nurse prescriber on the High Street pre-selling 149 per month memberships before an October opening; APA's Skin Plan ladder (95 founder, 115 standard) with a quarterly device rescan and written progress notes must be live at launch, not added later, or they will own the recurring-revenue client first."
  }
 ],
 "risks": [
  "Empty November diary tempts discounting. Guardrail: the pre-agreed slow-week playbook (extra scan slots, value-adds, retail credit windows) is written down before opening, and the no-percentage-off rule is treated as a licence condition, not a preference.",
  "The free scan attracts browsers and the 40 percent conversion target slips. Guardrail: the 30 pound scan deposit convertible to treatment credit, the weekly cap of 6 to 8 slots, and a weekly conversion review from week 3 with the script adjusted before the cap is ever raised.",
  "Winchester Medical Aesthetics hoovers up the membership market before 2 November. Guardrail: sell the Skin Plan to founding clients from the first scan in November rather than waiting for its January live date, and hold the ladder on the quarterly rescan and written progress notes as the differentiator their facials-only model cannot match.",
  "Founding pricing becomes permanent because the mature move never feels comfortable. Guardrail: the move is trigger-based (80 percent diary utilisation for two weeks plus 25 reviews at 4.9), diarised for review on 1 March 2027, and pre-announced as part of the founding story so it is expected, not apologised for.",
  "The Aesthetics Bae deepens its promotional pricing (already running sitewide laser offers and filler bundles) and resets local price perception for a quarter. Guardrail: never respond in price; respond in safety-and-aftercare messaging, and time a founding-places-remaining push against their noise.",
  "One-nurse capacity means courses and members could crowd out new-client slots by spring, capping growth at the exact moment reviews peak. Guardrail: protect a fixed weekly quota of new-client treatment slots, and treat sustained 90 percent utilisation as the signal to raise prices to mature levels early rather than to work longer weeks."
 ]
};
