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
  "antiWrinkle1": 210,
  "antiWrinkle2": 280,
  "antiWrinkle3": 330,
  "lipFiller05": 220,
  "lipFiller1": 320,
  "cheekFiller": 320,
  "jawChin": 340,
  "tearTrough": 400,
  "skinBooster": 220,
  "profhilo": 600,
  "polynucleotides": 300,
  "microneedling": 230,
  "chemicalPeel": 130
 },
 "maturePricing": {
  "antiWrinkle1": 230,
  "antiWrinkle2": 310,
  "antiWrinkle3": 360,
  "lipFiller05": 240,
  "lipFiller1": 350,
  "cheekFiller": 350,
  "jawChin": 380,
  "tearTrough": 450,
  "skinBooster": 240,
  "profhilo": 650,
  "polynucleotides": 330,
  "microneedling": 250,
  "chemicalPeel": 150
 },
 "launchAcv": 250,
 "matureAcv": 275,
 "strategy": "Winchester's market has a clear shape: a promotion-led budget anchor (The Aesthetics Bae), a salon mid-market around 190 to 220, a settled medical cluster at 200 to 225 for toxin and 300 for regenerative treatments, and doctor-led ceilings at 330 to 400. Abi's launch list slots deliberately into the top of the medical cluster: 210, 280 and 330 for anti-wrinkle, 320 per ml for lips and cheeks, 340 for jaw and chin, 400 tear troughs, Profhilo only as a course at 600, polynucleotides at 300 matching the doctor-led rate, and skin treatments priced as prescriptive courses rather than commodity singles. Every line has a published mature price 8 to 15 percent higher, which is the entire founding story: 40 named founding places lock launch pricing for 12 months, and the price rise in spring 2027 is announced proudly, not apologetically. The free capped AI scan replaces the consultation-fee debate entirely, protected by a 30 pound deposit that converts to treatment credit, and the 120 per month credit-bank membership with quarterly rescans must launch on day one because a rival nurse prescriber is already pre-selling memberships on the High Street. No percentage discounts ever: slow weeks get value-adds and access, never money off. Plan the finances on 230 per visit as agreed; the menu actually supports about 250 per paying visit, and the free scans absorb the difference, so 230 is honest rather than cautious.",
 "launchRationale": "Launch prices sit deliberately at the top of Winchester's verified medical cluster: level with or just under The Medical Aesthetic Clinic (the closest nurse-prescriber comparable) on every line, clearly above the salon tier, and below doctor-led ceilings only where the risk profile earns them. These are also the Founding prices, locked for 12 months for the first 40 clients.",
 "matureRationale": "Every line carries a published mature price 8 to 15 percent higher, moved to on triggers (80 percent diary utilisation for two weeks plus 25 reviews at 4.9), announced as a planned spring 2027 review. Founding members keep launch pricing, which is the entire founding value story.",
 "pricingTier": "premium",
 "keyRisk": "Empty November diary tempts discounting. Guardrail: the pre-agreed slow-week playbook (extra scan slots, value-adds, retail credit windows) is written down before opening, and the no-percentage-off rule is treated as a licence condition, not a preference.",
 "acvMix": "Months one to three skew toward first treatments off the scan: roughly 35 percent anti-wrinkle visits (mostly 2 and 3 area), 20 percent lip and dermal filler, 15 percent Profhilo course visits, 10 percent polynucleotides, 10 percent skin boosters, 10 percent microneedling and peels, with retail attaching to about a third of visits. Keep the financial model at 230. The verified launch menu supports about 250 per treatment visit, but the capped free analyses occupy 15 to 20 percent of diary slots at zero revenue, and blending those back in lands almost exactly on 230. Treat 230 as the planning floor, 250 as the operational target per paying visit, and revisit upward at the March price review rather than now.",
 "perTreatment": {
  "antiWrinkle1": "Launch at 210 sits level with Wessex Skin's doctor-led from-price and above Simply Skin and Hampshire Medical at 200, signalling medical seriousness without asking a new clinic to beat The Medical Aesthetic Clinic's 225 on day one. Mature at 230 quietly passes the nurse-led ceiling once reviews exist. Never look at Shideh's 140 or Bae's 150: prescriber-led toxin should not price against non-prescriber convenience.",
  "antiWrinkle2": "The market median is 265 and Dr Victoria charges 290. Launch at 280 lands deliberately between Simply Skin (270) and Dr Victoria, holding the current draft price. Mature at 310 sits just under Shideh's 320 combo, which is a paper price nobody markets. The 2-area line is the volume workhorse, so the 70 pound step from 1 area makes upgrading feel rational.",
  "antiWrinkle3": "Launch at 330 ties the verified ceiling (Dr Victoria and Simply Skin), which a nurse prescriber with an NHS background and a six-figure Jewry Street clinic can defend. The draft 350 was above every verified price with no reviews behind it; earn that later. Mature at 360 takes the city ceiling in year one, a 9 percent founding protection.",
  "lipFiller05": "Dr Victoria's 200 for 0.5ml Vycross is the verified ceiling, so the draft 280 was 40 percent above the doctor-led rate and would have stalled conversions. Launch at 220 claims the top of this line on product quality and safety story; mature 240. The natural-results positioning means half-ml lips are a signature entry treatment, not a bargain line: ignore Bae's 100 entirely.",
  "lipFiller1": "Priced against The Medical Aesthetic Clinic's 335 per ml as the closest nurse-prescriber comparable: launch just beneath it at 320 while APA has no reviews, mature at 350 just above it once it does, still 50 clear of Dr Victoria's 400 ceiling. The 100 pound gap from 0.5ml keeps the upgrade conversation honest. The median of 260 is dragged down by Bae and Shideh; do not price to it.",
  "cheekFiller": "Same per-ml logic as lips for menu coherence: one clean per-ml rate reads as principled, which suits the honest positioning, and mirrors how The Medical Aesthetic Clinic (335) and Dr Victoria (400 per ml) present. Launch 320, mature 350. Simply Skin's 300 is the mid-market reference APA should sit visibly above.",
  "jawChin": "Structural work justifies a modest premium over lip and cheek. Launch at 340 sits above The Medical Aesthetic Clinic's 335 and well clear of Shideh's outlier flat 200; mature at 380 restores the draft price, still 20 under Dr Victoria's 400. Multi-ml jaw plans should be quoted as bespoke plans off the scan, not off this single-ml line.",
  "tearTrough": "The highest-risk area on the menu is where prescriber credentials earn most. Launch at 400 sits between Simply Skin's 450 and the mid-market, mature at 450 matches Simply Skin with Dr Victoria's 550 as visible headroom. Shideh's 200 flat rate is a safety-story gift: use it in consultation to explain why cheap tear troughs are a red flag, never to price against.",
  "skinBooster": "The draft 300 was 20 percent above Essenziale's 250 Jalupro ceiling on a line where Bae sells Seventy Hyal at 140, too hostile for a funnel treatment. Launch at 220 prices above Simply Skin's 180 and below Essenziale, with the AI scan report as the differentiator; mature 240. This is a key first-treatment landing spot for scan converts, so it must feel reachable.",
  "profhilo": "The tightest band in the market: 500 to 600 with a 550 median. Launch at 600 matches the implied top (Shideh and Hampshire Medical at two 300 singles) and beats them on framing by selling the full protocol as one decision. Mature at 650 recovers the draft price and takes the city ceiling. Sold only as a course: Profhilo singles are a clinical nonsense and saying so on the menu reinforces the honest brand.",
  "polynucleotides": "The medical cluster (Shideh, Hampshire Medical, Wessex) has settled at exactly 300, so launch there: parity with doctor-led rates is itself a statement. Mature at 330 breaks the cluster once results photos exist. The draft 350 out of the gate risked losing scan converts to three clinics at 300. Lead with the course of 3 at 850 as the recommended plan.",
  "microneedling": "Medical-grade microneedling clusters at 250 to 280 (Simply Skin, Hampshire Medical, Wessex, The Medical Aesthetic Clinic at 280). The draft 200 undersold a nurse-delivered treatment against that cluster. Launch at 230, just under the cluster while new, mature at 250 to join it. Essenziale's 85 is a beauty facial, not a comparable, and Bae's 100 is exiting the market.",
  "chemicalPeel": "Entry peels are commoditised at 60 to 95 locally, a race APA must not enter. Price the peel as a prescriptive-grade, scan-directed treatment: launch 130, mature 150 to match The Medical Aesthetic Clinic's ceiling. Below about 120 a peel on Jewry Street loses money on chair time anyway at 30 to 40 appointments a week."
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
   "b": "Profhilo, polynucleotides, microneedling and peels are sold as complete protocols with the course as the headline price and the single as the reference price that makes the course look right. Profhilo: course of 2 at 600 (singles notionally 325, so the course saves 50). Polynucleotides: course of 3 at 850 against singles at 300. Microneedling: course of 3 at 620 against 230 singles. Peels: course of 3 at 350. The saving is built into the published price, framed as the correct clinical protocol priced properly, never as money off. This also pulls cash forward and locks the second and third visits into the diary, which stabilises a one-nurse capacity model."
  },
  {
   "h": "Founding Client mechanics: 40 places, engineered scarcity",
   "b": "The 40 Founding Client places are sold as a named, numbered list, not an offer. Each place costs nothing to join but requires a completed AI analysis and a booked first treatment before 31 December. Benefits: launch pricing locked for 12 months (they are protected from the mature list, worth roughly 8 to 15 percent per line), priority booking windows before slots open publicly, and a complimentary add-on with their first treatment plan (a peel or LED session worth up to 130, chosen clinically, not a voucher). Publish the counter (places remaining) on the site and in the window. When 40 is reached, close it publicly and visibly: the credibility of every future APA price depends on this cap being real."
  },
  {
   "h": "The membership: APA Skin Membership at 120 per month",
   "b": "One tier, credit-bank model: 120 per month, every pound banked as treatment and skincare credit, plus a quarterly AI rescan with progress report (the retention engine no competitor can copy), member pricing held at founding rates while active, priority booking, and one complimentary LED or dermaplane session per quarter. Minimum term 4 months, matching Winchester Medical Aesthetics' structure but undercutting their 149 founder rate while including injectables-grade credit they cannot offer facials against. Fifteen members by 31 December needs roughly one conversion per three founding clients plus a handful of scan converts, which is realistic if membership is offered at the end of every treatment plan presentation from day one. Fifteen members is 1800 of monthly recurring revenue and, more importantly, 15 diaries pre-committed."
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
   "read": "The real strategic threat: a nurse prescriber on the High Street pre-selling 149 per month memberships before an October opening; APA's 120 credit-bank membership with injectables credit and quarterly rescans must be live at launch, not added later, or they will own the recurring-revenue client first."
  }
 ],
 "risks": [
  "Empty November diary tempts discounting. Guardrail: the pre-agreed slow-week playbook (extra scan slots, value-adds, retail credit windows) is written down before opening, and the no-percentage-off rule is treated as a licence condition, not a preference.",
  "The free scan attracts browsers and the 40 percent conversion target slips. Guardrail: the 30 pound scan deposit convertible to treatment credit, the weekly cap of 6 to 8 slots, and a weekly conversion review from week 3 with the script adjusted before the cap is ever raised.",
  "Winchester Medical Aesthetics hoovers up the membership market before 2 November. Guardrail: sell APA membership to founding clients from the first scan in November rather than waiting for January, and hold the 120 price point with injectables credit as the differentiator their facials-only model cannot match.",
  "Founding pricing becomes permanent because the mature move never feels comfortable. Guardrail: the move is trigger-based (80 percent diary utilisation for two weeks plus 25 reviews at 4.9), diarised for review on 1 March 2027, and pre-announced as part of the founding story so it is expected, not apologised for.",
  "The Aesthetics Bae deepens its promotional pricing (already running sitewide laser offers and filler bundles) and resets local price perception for a quarter. Guardrail: never respond in price; respond in safety-and-aftercare messaging, and time a founding-places-remaining push against their noise.",
  "One-nurse capacity means courses and members could crowd out new-client slots by spring, capping growth at the exact moment reviews peak. Guardrail: protect a fixed weekly quota of new-client treatment slots, and treat sustained 90 percent utilisation as the signal to raise prices to mature levels early rather than to work longer weeks."
 ]
};
