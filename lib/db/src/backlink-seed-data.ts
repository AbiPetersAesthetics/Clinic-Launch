/**
 * Backlink tracker seed data.
 *
 * Copied verbatim from Abi_Peters_Backlink_Action_Plan.xlsx (the Semrush
 * backlink gap analysis of 21 September 2026). Every string below is a
 * workbook cell. Seeded once on startup like the risks and phases are, and
 * never re-applied over the top of real progress.
 */

export const BACKLINK_OPPORTUNITIES = [
  {
    "rank": 1,
    "priority": "P1 Now",
    "category": "Essential citations",
    "website": "Google Business Profile",
    "domain": "google.com",
    "why": "The most important local entity and map listing for Winchester and the existing clinic locations. It supports local discovery, reviews and consistent business details.",
    "competitors": "Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Free",
    "applyUrl": "https://business.google.com/locations",
    "infoNeeded": "Business name, each genuine staffed location, phone, website, booking link, hours, category, logo, photographs and verification evidence.",
    "template": "Direct setup",
    "status": "Check existing",
    "owner": "David",
    "notes": "Use one profile per eligible real-world clinic. Do not create duplicate profiles for the rebrand."
  },
  {
    "rank": 2,
    "priority": "P1 Now",
    "category": "Essential citations",
    "website": "Bing Places",
    "domain": "bing.com",
    "why": "A free map and business citation that also helps Microsoft search products. It appears in several competitor profiles.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Harley Street Skin Clinic, Perfect Skin Solutions, Sero Aesthetics",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Free",
    "applyUrl": "https://www.bingplaces.com/",
    "infoNeeded": "Import or match the verified Google profile, then check the name, address, phone, website and categories.",
    "template": "Direct setup",
    "status": "Check existing",
    "owner": "David",
    "notes": "Import from Google where available, then verify both Winchester and other eligible locations."
  },
  {
    "rank": 3,
    "priority": "P1 Now",
    "category": "Essential citations",
    "website": "Apple Business Connect",
    "domain": "apple.com",
    "why": "Controls how the clinic appears in Apple Maps, Siri and Apple place cards. It is a core local citation even though it appeared only in the national gap.",
    "competitors": "Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Free",
    "applyUrl": "https://businessconnect.apple.com/",
    "infoNeeded": "Apple Account, Companies House details, address, phone, website, hours, logo, photos and verification evidence.",
    "template": "Direct setup",
    "status": "Check existing",
    "owner": "David",
    "notes": "Create or claim each eligible clinic location."
  },
  {
    "rank": 4,
    "priority": "P1 Now",
    "category": "Essential citations",
    "website": "Yell",
    "domain": "yell.com",
    "why": "The clearest repeatable UK citation in the data. It appears across all four groups and links to multiple local and regional competitors.",
    "competitors": "Dr Leah, Lumineux Aesthetics, Meyer Clinic, Perfect Skin Solutions, Sero Aesthetics, The Flawless Guru, The Secret Garden Winchester",
    "groups": [
      "Bedhampton local",
      "Hampshire regional",
      "National",
      "Winchester"
    ],
    "cost": "Free basic listing; paid upsells",
    "applyUrl": "https://www.yell.com/free-listing/",
    "infoNeeded": "Listing pack, service categories, location details, opening hours, logo and images.",
    "template": "Direct setup",
    "status": "Check existing",
    "owner": "David",
    "notes": "Take the free listing. Decline paid SEO or advertising until referral value is demonstrated."
  },
  {
    "rank": 5,
    "priority": "P1 Now",
    "category": "Local authority",
    "website": "Winchester BID and Indie Winchester",
    "domain": "winchesterbid.co.uk",
    "why": "Highly relevant Winchester authority and a direct local competitor link. The Jewry Street clinic is within the BID area and should qualify as a levy-payer business.",
    "competitors": "Dr Victoria",
    "groups": [
      "Winchester"
    ],
    "cost": "Included through BID levy; confirm",
    "applyUrl": "https://winchesterbid.co.uk/contact-us/",
    "infoNeeded": "Opening date, 9A Jewry Street details, website, logo, short description, photographs and launch information.",
    "template": "T2",
    "status": "Awaiting response",
    "owner": "David",
    "notes": "Already contacted. Ask for both the Winchester BID business profile and Indie Winchester listing before opening."
  },
  {
    "rank": 6,
    "priority": "P1 Now",
    "category": "Professional credibility",
    "website": "Save Face",
    "domain": "saveface.co.uk",
    "why": "The highest-value attainable credibility link in the competitor data. Abi appears eligible as an NMC-registered nurse prescriber, subject to the full practitioner and premises assessment.",
    "competitors": "Lumineux Aesthetics, Perfect Skin Solutions, The Secret Garden Winchester",
    "groups": [
      "Bedhampton local",
      "Hampshire regional",
      "Winchester"
    ],
    "cost": "Paid accreditation; current fee supplied during application",
    "applyUrl": "https://www.saveface.co.uk/en/page/why-join-save-face",
    "infoNeeded": "NMC registration, prescribing status, training certificates, insurance, policies, consent and complication procedures, medicines governance and premises evidence.",
    "template": "T5",
    "status": "Not started",
    "owner": "Abi",
    "notes": "Treat this as accreditation and patient-safety work, not a backlink purchase. Start after the Winchester clinical setup and policies are inspection-ready."
  },
  {
    "rank": 7,
    "priority": "P1 Now",
    "category": "Professional credibility",
    "website": "The Tweakments Guide",
    "domain": "thetweakmentsguide.com",
    "why": "Strong topical relevance and repeated presence across Winchester, local and national competitors. A quality clinic or practitioner profile can drive qualified referral traffic as well as authority.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Perfect Skin Solutions, The Secret Garden Winchester, Wessex Skin",
    "groups": [
      "Bedhampton local",
      "National",
      "Winchester"
    ],
    "cost": "Likely paid or editorially approved; request current terms",
    "applyUrl": "https://www.thetweakmentsguide.com/contact/",
    "infoNeeded": "Practitioner biography, qualifications, treatments, prices, clinic photos, before-and-after images, safety credentials and locations.",
    "template": "T4",
    "status": "Not started",
    "owner": "David",
    "notes": "Ask specifically about a practitioner/clinic profile for a nurse-led Winchester clinic and whether both Winchester and Bedhampton can be represented."
  },
  {
    "rank": 8,
    "priority": "P1 Now",
    "category": "Professional credibility",
    "website": "Obagi UK",
    "domain": "obagiuk.com",
    "why": "Abi already has a genuine supplier relationship and opening stock. A clinic finder, authorised stockist profile or launch case study is more defensible than a generic directory link.",
    "competitors": "Dr Leah",
    "groups": [
      "National"
    ],
    "cost": "Normally included in supplier relationship; confirm",
    "applyUrl": "https://obagiuk.com/pages/contact-us",
    "infoNeeded": "Obagi account details, clinic locations, practitioner credentials, launch date, product/treatment offering and approved brand imagery.",
    "template": "T3",
    "status": "In progress",
    "owner": "Abi",
    "notes": "Ask the account manager for the authorised clinic locator and whether a Winchester opening feature is available."
  },
  {
    "rank": 9,
    "priority": "P1 Now",
    "category": "Professional credibility",
    "website": "Dermalux",
    "domain": "dermaluxled.com",
    "why": "A manufacturer locator or case study would be strongly relevant if the Tri-Wave MD purchase proceeds. Perfect Skin Solutions has a Dermalux link in Group 2.",
    "competitors": "Perfect Skin Solutions",
    "groups": [
      "Bedhampton local"
    ],
    "cost": "Normally relationship-based; confirm",
    "applyUrl": "https://dermaluxled.com/contact/",
    "infoNeeded": "Device serial/order, trained practitioner details, clinic address, treatment page, photos and launch date.",
    "template": "T3",
    "status": "Dependent",
    "owner": "Abi",
    "notes": "Do not pursue until the device is ordered and installed. Then request clinic locator inclusion and offer a SkinTech plus Dermalux case study."
  },
  {
    "rank": 10,
    "priority": "P1 Now",
    "category": "Local authority",
    "website": "Visit Winchester",
    "domain": "visitwinchester.co.uk",
    "why": "A Winchester tourism or local-business feature is geographically powerful and can introduce the new clinic to visitors and residents.",
    "competitors": "Strategic addition; not surfaced in supplied gap",
    "groups": [
      "Strategic addition"
    ],
    "cost": "Earned; partnership terms may vary",
    "applyUrl": "https://www.visitwinchester.co.uk/contact-us/",
    "infoNeeded": "Opening story, location, services, high-quality interior and team photography, website, booking link and visitor-relevant angle.",
    "template": "T2",
    "status": "Awaiting response",
    "owner": "David",
    "notes": "Already contacted via tourism@winchester.gov.uk. Follow up after the opening date and finished-clinic photography are confirmed."
  },
  {
    "rank": 11,
    "priority": "P1 Now",
    "category": "Local authority",
    "website": "Hampshire Business News",
    "domain": "hampshirebiznews.co.uk",
    "why": "A new independent clinic, healthcare business investment and city-centre opening provide a credible Hampshire business story.",
    "competitors": "Strategic addition; not surfaced in supplied gap",
    "groups": [
      "Strategic addition"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://hampshirebiznews.co.uk/contact/",
    "infoNeeded": "Launch date, investment and jobs angle, founder quote, exterior/interior photos, website and contact details.",
    "template": "T2",
    "status": "Awaiting response",
    "owner": "David",
    "notes": "Already contacted. Follow up with finished premises imagery and a firm opening date."
  },
  {
    "rank": 12,
    "priority": "P1 Now",
    "category": "Local authority",
    "website": "Hampshire Chronicle",
    "domain": "hampshirechronicle.co.uk",
    "why": "The most directly relevant local newspaper target for a Winchester opening and expert local-health commentary.",
    "competitors": "Strategic addition; not surfaced in supplied gap",
    "groups": [
      "Strategic addition"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://www.hampshirechronicle.co.uk/contactus/",
    "infoNeeded": "Concise press release, local angle, opening date, founder biography, photography and spokesperson availability.",
    "template": "T2",
    "status": "Not started",
    "owner": "David",
    "notes": "Pitch the opening first. Later offer Abi for seasonal skin-health and aesthetics-safety commentary."
  },
  {
    "rank": 13,
    "priority": "P1 Now",
    "category": "Local authority",
    "website": "The News Portsmouth",
    "domain": "portsmouth.co.uk",
    "why": "Group 2 shows a competitor link from this high-authority regional title. It is relevant to Bedhampton, Havant and Portsmouth-area patients.",
    "competitors": "Perfect Skin Solutions",
    "groups": [
      "Bedhampton local"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://www.portsmouth.co.uk/contact-us",
    "infoNeeded": "Bedhampton-specific story, expert quote, local patient-safety angle, images and contact availability.",
    "template": "T2",
    "status": "Not started",
    "owner": "David",
    "notes": "Use a Bedhampton or Havant angle rather than the Winchester opening."
  },
  {
    "rank": 14,
    "priority": "P1 Now",
    "category": "Essential citations",
    "website": "The Skin Directory",
    "domain": "theskindirectory.com",
    "why": "Topically relevant and present across three groups. The site currently offers a permanent free listing and paid upgrades.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Perfect Skin Solutions, The Secret Garden Winchester, Wessex Skin",
    "groups": [
      "Bedhampton local",
      "National",
      "Winchester"
    ],
    "cost": "Free; £5 Silver or £20 Gold one-off",
    "applyUrl": "https://www.theskindirectory.com/new_listing.asp",
    "infoNeeded": "Website URL, title, short description, contact email and suitable skin-clinic category.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Use the free listing first. Do not buy the SEO-focused upgrade unless it produces measurable referrals."
  },
  {
    "rank": 15,
    "priority": "P1 Now",
    "category": "Editorial opportunities",
    "website": "Get The Gloss",
    "domain": "getthegloss.com",
    "why": "A highly relevant UK beauty and skin publication. Competitor links occur in Winchester, local and national datasets and are likely earned expert citations.",
    "competitors": "Dr Sophie Shotter, Harley Street Skin Clinic, Perfect Skin Solutions, Wessex Skin",
    "groups": [
      "Bedhampton local",
      "National",
      "Winchester"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://www.getthegloss.com/contact-us",
    "infoNeeded": "Abi's expert biography, headshot, concise commentary topics, evidence-led answers and rapid response availability.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Pitch Abi as an ANP and Independent Prescriber for safe injectables, skin analysis and evidence-led skincare commentary."
  },
  {
    "rank": 16,
    "priority": "P1 Now",
    "category": "Editorial opportunities",
    "website": "Aesthetic Medicine",
    "domain": "aestheticmed.co.uk",
    "why": "Relevant industry publication with competitor links in the local and national groups. Suitable for the Winchester opening, clinical commentary and practice-development stories.",
    "competitors": "Dr Sophie Shotter, Harley Street Skin Clinic, Perfect Skin Solutions",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Earned editorial; commercial packages also offered",
    "applyUrl": "https://aestheticmed.co.uk/contact-us",
    "infoNeeded": "Professional biography, high-resolution headshot, clinic imagery, article idea, evidence and disclosure of commercial relationships.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Prioritise editorial contribution or news coverage, not paid advertorial solely for a backlink."
  },
  {
    "rank": 17,
    "priority": "P1 Now",
    "category": "Editorial opportunities",
    "website": "Professional Beauty",
    "domain": "professionalbeauty.co.uk",
    "why": "Repeated national-competitor link and strong industry relevance. Useful for credible launch, technology and regulation-led stories.",
    "competitors": "Dr Leah, Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Earned editorial; paid commercial options available",
    "applyUrl": "https://professionalbeauty.co.uk/site/contact",
    "infoNeeded": "News release, professional biography, clinic and device images, launch facts and a clear industry angle.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Pitch the nurse-led clinical model, the analyser-led pathway or forthcoming regulation rather than a generic opening announcement."
  },
  {
    "rank": 18,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Thomson Local",
    "domain": "thomsonlocal.com",
    "why": "Recognised UK business citation found in the Winchester group. A basic listing is available without buying an advertising package.",
    "competitors": "Dr Victoria",
    "groups": [
      "Winchester"
    ],
    "cost": "Free basic; paid upgrades",
    "applyUrl": "https://www.thomsonlocal.com/search",
    "infoNeeded": "Listing pack and location-specific service categories.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Create only the free basic listing and keep name, address and phone identical to Google."
  },
  {
    "rank": 19,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Hotfrog UK",
    "domain": "hotfrog.co.uk",
    "why": "Established general UK directory found in the Hampshire group. Useful as a supporting citation, but not a major authority win.",
    "competitors": "Lumineux Aesthetics",
    "groups": [
      "Hampshire regional"
    ],
    "cost": "Free basic; paid options may be offered",
    "applyUrl": "https://www.hotfrog.co.uk/add-business",
    "infoNeeded": "Listing pack, service categories and photographs.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Use only the free listing."
  },
  {
    "rank": 20,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "My Local Services",
    "domain": "mylocalservices.co.uk",
    "why": "General UK citation present in local and national competitor data. Useful for consistency but lower value than Yell or local organisations.",
    "competitors": "Harley Street Skin Clinic, The Flawless Guru",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Free/basic; verify before any upgrade",
    "applyUrl": "https://www.mylocalservices.co.uk/add-business/",
    "infoNeeded": "Listing pack and location details.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Free listing only."
  },
  {
    "rank": 21,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "118 Business Directory",
    "domain": "118businessdirectory.co.uk",
    "why": "A repeatable general citation found in Group 2. The site promotes free business listings.",
    "competitors": "Sero Aesthetics",
    "groups": [
      "Bedhampton local"
    ],
    "cost": "Free basic; paid SEO upsells",
    "applyUrl": "https://118businessdirectory.co.uk/add-your-business",
    "infoNeeded": "Listing pack, category, location, hours and contact details.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Take the listing but decline SEO packages."
  },
  {
    "rank": 22,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Find Open UK",
    "domain": "find-open.co.uk",
    "why": "Appears for competitors in Group 2 and can reinforce opening hours and location consistency.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Perfect Skin Solutions, Sero Aesthetics",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Free claim/correction; verify",
    "applyUrl": "https://find-open.co.uk/add-company",
    "infoNeeded": "Listing pack, accurate hours and proof of ownership if an existing record is claimed.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Check for an automatically generated record before creating a new one."
  },
  {
    "rank": 23,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "BizSeek UK",
    "domain": "bizseek.co.uk",
    "why": "Supporting UK citation in Group 2. Lower priority, but reasonable if the listing can be claimed without charge.",
    "competitors": "Dr Leah, Harley Street Skin Clinic, Sero Aesthetics",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Free claim/correction; verify",
    "applyUrl": "https://www.bizseek.co.uk/add-business",
    "infoNeeded": "Listing pack and ownership verification.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Do not pay. Correct an existing entry rather than duplicate it."
  },
  {
    "rank": 24,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "UK Small Business Directory",
    "domain": "uksmallbusinessdirectory.co.uk",
    "why": "A UK-focused directory appearing in the national competitor set. It is more relevant than the foreign and machine-generated directories in the exports.",
    "competitors": "Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Free/basic with paid upgrades; verify",
    "applyUrl": "https://www.uksmallbusinessdirectory.co.uk/add-listing/",
    "infoNeeded": "Listing pack and appropriate clinic category.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Use the lowest-cost legitimate listing only; do not buy link packages."
  },
  {
    "rank": 25,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Free Listing UK",
    "domain": "freelistinguk.com",
    "why": "A supporting UK citation found in the Hampshire group. It is lower authority but can be used in the controlled citation batch.",
    "competitors": "Harley Street Skin Clinic, Lumineux Aesthetics, Meyer Clinic",
    "groups": [
      "Hampshire regional",
      "National"
    ],
    "cost": "Free",
    "applyUrl": "https://www.freelistinguk.com/add-listing",
    "infoNeeded": "Listing pack.",
    "template": "Direct setup",
    "status": "Not started",
    "owner": "David",
    "notes": "Complete only after all P1 citations are consistent."
  },
  {
    "rank": 26,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Aesthetic Directory",
    "domain": "aestheticdirectory.co.uk",
    "why": "Industry-specific directory repeated in local and national competitor data. Relevance is stronger than most generic directories, although authority is modest.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Harley Street Skin Clinic, Perfect Skin Solutions",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Confirm current listing terms; do not pay without referral value",
    "applyUrl": "https://aestheticdirectory.co.uk/contact/",
    "infoNeeded": "Practitioner credentials, clinic details, treatment list, images and website.",
    "template": "T1",
    "status": "Not started",
    "owner": "David",
    "notes": "Ask for current listing terms and whether the outbound website link is included."
  },
  {
    "rank": 27,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Glowmi",
    "domain": "glowmi.co.uk",
    "why": "A beauty and aesthetics discovery site appearing in all four groups. Its authority is low, so it is useful only as a free, accurate citation.",
    "competitors": "Dr Leah, Hampshire Medical, Harley Street Skin Clinic, Just Skin Aesthetic Clinic, Lumineux Aesthetics, Pallant Aesthetics, Perfect Skin Solutions, The Secret Garden Winchester, Wessex Skin",
    "groups": [
      "Bedhampton local",
      "Hampshire regional",
      "National",
      "Winchester"
    ],
    "cost": "Free or provider-plan dependent; confirm",
    "applyUrl": "https://glowmi.co.uk/",
    "infoNeeded": "Listing pack, services and images.",
    "template": "T1",
    "status": "Not started",
    "owner": "David",
    "notes": "Proceed only if free and no reciprocal link is required."
  },
  {
    "rank": 28,
    "priority": "P2 Next",
    "category": "Essential citations",
    "website": "Salon Searcher",
    "domain": "salonsearcher.co.uk",
    "why": "A relevant but low-authority directory shared by three Winchester competitors.",
    "competitors": "Dr Victoria, Hampshire Medical, Wessex Skin",
    "groups": [
      "Winchester"
    ],
    "cost": "Confirm; free only recommended",
    "applyUrl": "https://www.salonsearcher.co.uk/",
    "infoNeeded": "Listing pack and suitable medical-aesthetics category.",
    "template": "T1",
    "status": "Not started",
    "owner": "David",
    "notes": "Use only if the clinic fits the directory and the listing is free."
  },
  {
    "rank": 29,
    "priority": "P2 Next",
    "category": "Professional credibility",
    "website": "Consulting Room",
    "domain": "consultingroom.com",
    "why": "Established UK aesthetics information and clinic-search platform found in the national group. More credible than a general link directory.",
    "competitors": "Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Paid or service package; request current terms",
    "applyUrl": "https://www.consultingroom.com/Services/Contact.asp",
    "infoNeeded": "Clinic profile, credentials, treatment list, address, images and enquiry to admin@consultingroom.com.",
    "template": "T4",
    "status": "Not started",
    "owner": "David",
    "notes": "Request pricing and referral data before committing."
  },
  {
    "rank": 30,
    "priority": "P2 Next",
    "category": "Professional credibility",
    "website": "Three Best Rated",
    "domain": "threebestrated.co.uk",
    "why": "Appears in both Winchester and local datasets and has meaningful consumer visibility. Inclusion is selected rather than bought as a normal directory entry.",
    "competitors": "Dr Victoria, Perfect Skin Solutions, The Secret Garden Winchester",
    "groups": [
      "Bedhampton local",
      "Winchester"
    ],
    "cost": "Free nomination/selection; no guaranteed placement",
    "applyUrl": "https://threebestrated.co.uk/suggest-business",
    "infoNeeded": "Full business details, reviews, qualifications, history and evidence of local reputation.",
    "template": "Direct nomination",
    "status": "Not started",
    "owner": "David",
    "notes": "Nominate after the Winchester profile has reviews and a stable address. Never pay a third party promising selection."
  },
  {
    "rank": 31,
    "priority": "P2 Next",
    "category": "Professional credibility",
    "website": "Safety in Beauty",
    "domain": "safetyinbeauty.com",
    "why": "Relevant safety-led industry brand linked to Wessex Skin. Potential value comes from genuine awards, verification or editorial participation.",
    "competitors": "Wessex Skin",
    "groups": [
      "Winchester"
    ],
    "cost": "Award, event or programme dependent",
    "applyUrl": "https://safetyinbeauty.com/contact/",
    "infoNeeded": "Qualifications, safety policies, case evidence, testimonials and award-specific material.",
    "template": "T5",
    "status": "Not started",
    "owner": "Abi",
    "notes": "Consider only a genuine programme with clear standards. Do not buy a badge solely for SEO."
  },
  {
    "rank": 32,
    "priority": "P2 Next",
    "category": "Professional credibility",
    "website": "RealSelf",
    "domain": "realself.com",
    "why": "High-visibility treatment and practitioner platform present in the national group. It may provide patient discovery, but practitioner eligibility and UK value must be confirmed.",
    "competitors": "Dr Leah",
    "groups": [
      "National"
    ],
    "cost": "Profile may be free; paid promotion available",
    "applyUrl": "https://www.realself.com/dr/register",
    "infoNeeded": "Professional registration, qualifications, treatment evidence, profile images and eligibility confirmation for an ANP/IP.",
    "template": "Direct application",
    "status": "Not started",
    "owner": "Abi",
    "notes": "Proceed only if nurse prescribers are eligible and the free profile includes a website link."
  },
  {
    "rank": 33,
    "priority": "P2 Next",
    "category": "Editorial opportunities",
    "website": "SheerLuxe",
    "domain": "sheerluxe.com",
    "why": "Strong lifestyle publication linked to leading local and national clinics. Best approached through expert commentary, not a listing request.",
    "competitors": "Dr Sophie Shotter, Harley Street Skin Clinic, Perfect Skin Solutions",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://sheerluxe.com/contact",
    "infoNeeded": "Expert biography, headshot, quick-response topics and concise evidence-led commentary.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Target skin health, safe aesthetics and non-sensational expert commentary."
  },
  {
    "rank": 34,
    "priority": "P2 Next",
    "category": "Editorial opportunities",
    "website": "Country and Town House",
    "domain": "countryandtownhouse.com",
    "why": "Linked to three national benchmark clinics and potentially relevant to affluent Hampshire and Winchester audiences.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://www.countryandtownhouse.com/contact/",
    "infoNeeded": "Expert biography, strong local/lifestyle angle, headshot and rapid-response availability.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Pitch Winchester wellbeing, skin health or expert seasonal guidance rather than a backlink request."
  },
  {
    "rank": 35,
    "priority": "P2 Next",
    "category": "Editorial opportunities",
    "website": "Women’s Health",
    "domain": "womenshealthmag.com",
    "why": "Repeated high-authority editorial source across Winchester, local and national groups. It represents the PR route that separates stronger competitors from directory-only clinics.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Perfect Skin Solutions, Wessex Skin",
    "groups": [
      "Bedhampton local",
      "National",
      "Winchester"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://www.womenshealthmag.com/uk/about/a26372542/contact-us/",
    "infoNeeded": "Expert biography, evidence-led answers, headshot and fast response to journalist deadlines.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Long-term media target. Build credentials with local and trade coverage first."
  },
  {
    "rank": 36,
    "priority": "P2 Next",
    "category": "Editorial opportunities",
    "website": "Woman and Home",
    "domain": "womanandhome.com",
    "why": "Repeated high-authority editorial source across three groups, with strong audience relevance for skin health and age-positive aesthetics.",
    "competitors": "Dr Leah, Dr Sophie Shotter, Harley Street Skin Clinic, Perfect Skin Solutions, Wessex Skin",
    "groups": [
      "Bedhampton local",
      "National",
      "Winchester"
    ],
    "cost": "Earned editorial",
    "applyUrl": "https://www.womanandhome.com/contact-us/",
    "infoNeeded": "Expert biography, topical commentary and quick turnaround.",
    "template": "T3",
    "status": "Not started",
    "owner": "David",
    "notes": "Long-term media target after establishing an expert-commentary process."
  },
  {
    "rank": 37,
    "priority": "P3 Later",
    "category": "Essential citations",
    "website": "Ratings Plus",
    "domain": "ratingsplus.co.uk",
    "why": "Appears across Winchester and Hampshire competitors, but its real referral value and control over listings are unclear.",
    "competitors": "Dr Victoria, Just Skin Aesthetic Clinic, Lumineux Aesthetics, The Secret Garden Winchester, Wessex Skin",
    "groups": [
      "Hampshire regional",
      "Winchester"
    ],
    "cost": "Confirm; do not pay initially",
    "applyUrl": "https://ratingsplus.co.uk/contact-us/",
    "infoNeeded": "Existing listing check and business verification.",
    "template": "T1",
    "status": "Not started",
    "owner": "David",
    "notes": "Only claim or correct a listing. Do not purchase reputation services for backlink purposes."
  },
  {
    "rank": 38,
    "priority": "P3 Later",
    "category": "Essential citations",
    "website": "Yably",
    "domain": "yably.co.uk",
    "why": "Review aggregator linked to Group 2 competitors. It can support citation consistency but is unlikely to be a material authority driver.",
    "competitors": "Dr Victoria, Perfect Skin Solutions, The Flawless Guru",
    "groups": [
      "Bedhampton local",
      "Winchester"
    ],
    "cost": "Usually claim/correction; confirm",
    "applyUrl": "https://yably.co.uk/",
    "infoNeeded": "Existing record check and matching business details.",
    "template": "Direct claim",
    "status": "Not started",
    "owner": "David",
    "notes": "Do not create duplicates or pay for promotion."
  },
  {
    "rank": 39,
    "priority": "P3 Later",
    "category": "Essential citations",
    "website": "Opening Times",
    "domain": "opening-times.co.uk",
    "why": "Supporting hours-and-location citation found in Group 2. Useful only for accurate local data.",
    "competitors": "Harley Street Skin Clinic, The Flawless Guru",
    "groups": [
      "Bedhampton local",
      "National"
    ],
    "cost": "Free correction/submission; verify",
    "applyUrl": "https://www.opening-times.co.uk/",
    "infoNeeded": "Exact address, phone and opening hours.",
    "template": "Direct claim",
    "status": "Not started",
    "owner": "David",
    "notes": "Low priority after core map and directory profiles."
  },
  {
    "rank": 40,
    "priority": "P3 Later",
    "category": "Partnerships",
    "website": "British Forces Discounts",
    "domain": "britishforcesdiscounts.co.uk",
    "why": "A Hampshire competitor link and a potentially authentic fit if the clinic chooses to offer a defined Armed Forces discount.",
    "competitors": "Lumineux Aesthetics",
    "groups": [
      "Hampshire regional"
    ],
    "cost": "Relationship/listing dependent; requires a real offer",
    "applyUrl": "https://britishforcesdiscounts.co.uk/business-sign-up",
    "infoNeeded": "Agreed discount, eligibility terms, clinic details and booking instructions.",
    "template": "T6",
    "status": "Dependent",
    "owner": "David",
    "notes": "Only pursue if the clinic wants a sustainable Armed Forces offer. Do not create a token discount for a link."
  },
  {
    "rank": 41,
    "priority": "P3 Later",
    "category": "Partnerships",
    "website": "Key Worker Discounts",
    "domain": "keyworkerdiscounts.uk",
    "why": "Potentially relevant to a nurse-led clinic and appeared in the Hampshire group. Value depends on offering a genuine, financially sensible benefit.",
    "competitors": "Lumineux Aesthetics",
    "groups": [
      "Hampshire regional"
    ],
    "cost": "Relationship/listing dependent; requires a real offer",
    "applyUrl": "https://keyworkerdiscounts.uk/",
    "infoNeeded": "Approved discount, eligibility rules, clinic details and booking instructions.",
    "template": "T6",
    "status": "Dependent",
    "owner": "David",
    "notes": "Assess margin and operational impact before applying."
  },
  {
    "rank": 42,
    "priority": "P3 Later",
    "category": "Partnerships",
    "website": "Pink Ribbon Foundation",
    "domain": "pinkribbonfoundation.org.uk",
    "why": "A national competitor has a substantial relationship-based link footprint. A genuine local fundraising or awareness partnership could create trust, coverage and links.",
    "competitors": "Harley Street Skin Clinic",
    "groups": [
      "National"
    ],
    "cost": "Donation or campaign dependent",
    "applyUrl": "https://pinkribbonfoundation.org.uk/contact-us/",
    "infoNeeded": "Genuine campaign concept, fundraising commitment, dates, safeguarding of health claims and promotional assets.",
    "template": "T6",
    "status": "Not started",
    "owner": "Abi",
    "notes": "Only pursue if it fits the clinic’s values and can be sustained beyond a one-off backlink exercise."
  }
] as const;

export const BACKLINK_LISTING_PACK = [
  {
    "section": "Identity",
    "field": "Trading name",
    "value": "Abi Peters Skin Clinic",
    "remaining": "Confirm exact punctuation and capitalisation for every listing.",
    "status": "Known",
    "sortOrder": 1
  },
  {
    "section": "Identity",
    "field": "Legal entity",
    "value": "Abi Peters Aesthetics Ltd",
    "remaining": "Use only where a platform asks for the registered company.",
    "status": "Known",
    "sortOrder": 2
  },
  {
    "section": "Digital",
    "field": "Website",
    "value": "https://www.abipetersskinclinic.co.uk/",
    "remaining": "Confirm preferred canonical URL with or without www.",
    "status": "Known",
    "sortOrder": 3
  },
  {
    "section": "Location",
    "field": "Winchester address",
    "value": "9A Jewry Street, Winchester",
    "remaining": "Add the full postcode and confirm the public opening date before publishing.",
    "status": "Incomplete",
    "sortOrder": 4
  },
  {
    "section": "Location",
    "field": "Bedhampton address",
    "value": "",
    "remaining": "Supply the exact public-facing address and whether it is eligible for a separate Google profile.",
    "status": "Missing",
    "sortOrder": 5
  },
  {
    "section": "Location",
    "field": "Denmead address",
    "value": "",
    "remaining": "Supply the exact public-facing address and eligibility for listings.",
    "status": "Missing",
    "sortOrder": 6
  },
  {
    "section": "Contact",
    "field": "Main telephone number",
    "value": "",
    "remaining": "Choose one consistent public number or define a location-specific number strategy.",
    "status": "Missing",
    "sortOrder": 7
  },
  {
    "section": "Contact",
    "field": "Business email",
    "value": "",
    "remaining": "Use the skin-clinic domain rather than the retiring domain.",
    "status": "Missing",
    "sortOrder": 8
  },
  {
    "section": "Digital",
    "field": "Booking link",
    "value": "",
    "remaining": "Supply the canonical booking URL and location-specific links if available.",
    "status": "Missing",
    "sortOrder": 9
  },
  {
    "section": "Digital",
    "field": "Instagram",
    "value": "",
    "remaining": "Supply the final profile URL.",
    "status": "Missing",
    "sortOrder": 10
  },
  {
    "section": "Digital",
    "field": "LinkedIn company page",
    "value": "Abi Peters Skin Clinic",
    "remaining": "Add the final public URL.",
    "status": "Incomplete",
    "sortOrder": 11
  },
  {
    "section": "Operations",
    "field": "Opening hours",
    "value": "",
    "remaining": "Provide hours for Winchester, Bedhampton and Denmead separately.",
    "status": "Missing",
    "sortOrder": 12
  },
  {
    "section": "Practitioner",
    "field": "Clinical lead",
    "value": "Abi Peters, Advanced Nurse Practitioner and Independent Prescriber",
    "remaining": "Confirm the exact post-nominals and preferred public title.",
    "status": "Incomplete",
    "sortOrder": 13
  },
  {
    "section": "Practitioner",
    "field": "NMC registration",
    "value": "",
    "remaining": "Add the registration number only where appropriate and required.",
    "status": "Missing",
    "sortOrder": 14
  },
  {
    "section": "Practitioner",
    "field": "Qualifications",
    "value": "",
    "remaining": "Create an approved ordered list with awarding bodies and dates where needed.",
    "status": "Missing",
    "sortOrder": 15
  },
  {
    "section": "Practitioner",
    "field": "Insurance",
    "value": "",
    "remaining": "Prepare current insurer, policy scope and expiry evidence for accreditation applications.",
    "status": "Missing",
    "sortOrder": 16
  },
  {
    "section": "Services",
    "field": "Core treatments",
    "value": "Skin consultations and analysis; anti-wrinkle treatments; dermal fillers; Skinvive; polynucleotides; Profhilo; Obagi skincare and peels; microneedling; B12",
    "remaining": "Confirm the launch treatment list and remove anything not offered at each location.",
    "status": "Incomplete",
    "sortOrder": 17
  },
  {
    "section": "Assets",
    "field": "Logo",
    "value": "",
    "remaining": "Prepare colour, black and white, square and transparent PNG versions.",
    "status": "Missing",
    "sortOrder": 18
  },
  {
    "section": "Assets",
    "field": "Clinic photographs",
    "value": "",
    "remaining": "Prepare exterior, reception and treatment-room images after completion.",
    "status": "Missing",
    "sortOrder": 19
  },
  {
    "section": "Assets",
    "field": "Practitioner headshot",
    "value": "",
    "remaining": "Prepare one consistent high-resolution portrait with usage permission.",
    "status": "Missing",
    "sortOrder": 20
  },
  {
    "section": "Copy",
    "field": "Short description",
    "value": "Abi Peters Skin Clinic is a nurse-led medical aesthetics and skin-health clinic in Winchester. Led by Advanced Nurse Practitioner and Independent Prescriber Abi Peters, the clinic provides evidence-informed skin consultations, injectable treatments and medical-grade skincare, with an emphasis on natural results, patient safety and personalised treatment planning.",
    "remaining": "Approve before reuse.",
    "status": "Draft",
    "sortOrder": 21
  },
  {
    "section": "Copy",
    "field": "Long description",
    "value": "Abi Peters Skin Clinic is a nurse-led medical aesthetics and skin-health clinic led by Advanced Nurse Practitioner and Independent Prescriber Abi Peters. The clinic combines detailed consultation and skin analysis with personalised treatment planning, evidence-informed injectable treatments and medical-grade skincare. Services include anti-wrinkle treatments, dermal fillers, Skinvive, polynucleotides, Profhilo, Obagi skincare and peels, microneedling and supportive skin-health programmes. The approach is deliberately clinical and unhurried, with careful assessment of suitability, realistic discussion of outcomes and a focus on natural-looking results. The new Winchester clinic at 9A Jewry Street will provide a dedicated city-centre setting alongside Abi's established Hampshire practice. Every public listing should use the same approved business details, practitioner credentials, booking route and location-specific opening hours.",
    "remaining": "Approve and adapt by platform character limit.",
    "status": "Draft",
    "sortOrder": 22
  }
] as const;

export const BACKLINK_TEMPLATES = [
  {
    "templateId": "T1",
    "use": "Directory listing enquiry",
    "wording": "Hello, I’m contacting you on behalf of Abi Peters Skin Clinic, a nurse-led aesthetics and skin-health clinic with locations in Hampshire and a new Winchester clinic opening at 9A Jewry Street. Please could you confirm your current clinic-listing options, whether a basic listing includes a direct website link, and any cost? I can provide our complete business details, practitioner credentials, logo and photographs."
  },
  {
    "templateId": "T2",
    "use": "Local opening and business story",
    "wording": "Hello, I’m getting in touch about the opening of Abi Peters Skin Clinic at 9A Jewry Street, Winchester. The clinic is led by Abi Peters, an Advanced Nurse Practitioner and Independent Prescriber, and will focus on evidence-led skin health and medical aesthetics. We can provide the confirmed opening date, founder interview, investment and employment details, and professional photographs. Would this be suitable for your local business or health coverage?"
  },
  {
    "templateId": "T3",
    "use": "Expert commentary and editorial pitch",
    "wording": "Hello, I’d like to offer Abi Peters as an expert source for forthcoming skin-health and medical-aesthetics features. Abi is an Advanced Nurse Practitioner and Independent Prescriber who can provide concise, evidence-led commentary on skin analysis, prescription skincare, injectable safety, treatment suitability and realistic outcomes. She is available for rapid written responses and can supply a professional headshot and full credentials."
  },
  {
    "templateId": "T4",
    "use": "Clinic platform or supplier profile",
    "wording": "Hello, Abi Peters Skin Clinic is a nurse-led medical aesthetics and skin-health clinic opening in central Winchester, alongside established Hampshire services. We would like to understand whether Abi and the clinic are eligible for your practitioner or clinic finder. Please send the current inclusion criteria, costs, profile benefits and required evidence. We can provide NMC and prescribing credentials, insurance, treatment details, clinic imagery and website links."
  },
  {
    "templateId": "T5",
    "use": "Accreditation or safety programme enquiry",
    "wording": "Hello, I’m contacting you on behalf of Abi Peters Skin Clinic. Abi is an Advanced Nurse Practitioner and Independent Prescriber providing medical aesthetics and skin-health services. We are preparing a new clinical premises in Winchester and would like to understand your practitioner and premises accreditation requirements, current fees, assessment timescale and documentation checklist. Patient safety and demonstrable clinical standards are the reasons for our enquiry."
  },
  {
    "templateId": "T6",
    "use": "Genuine partnership enquiry",
    "wording": "Hello, I’m contacting you from Abi Peters Skin Clinic, a nurse-led aesthetics and skin-health clinic in Hampshire. We are exploring a genuine partnership that would provide a clear benefit to your community rather than a one-off promotion. Please could you share your current partnership criteria, commitments, costs and listing or campaign options? We would be happy to discuss an appropriate offer or activity before submitting anything publicly."
  }
] as const;
