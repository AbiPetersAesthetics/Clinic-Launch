/**
 * Backlink analysis reference data.
 *
 * Read-only conclusions from Abi_Peters_Backlink_Action_Plan.xlsx. These are
 * findings rather than working state, so unlike the opportunities, the listing
 * pack and the templates they are not stored in the database and cannot be
 * edited. Every string is a workbook cell.
 */

export interface SkipItem {
  category: string;
  examples: string;
  seenIn: string;
  why: string;
  reconsider: string;
}

export interface GroupSummary {
  group: string;
  gapRows: number;
  competitors: string[];
  rawLeader: string;
  /** Rows in the supplied gap whose Authority Score was 30 or above. */
  leaderStrongRows: number;
  conclusion: string;
}

export interface CompetitorRow {
  group: string;
  competitor: string;
  domains: number;
  strongRows: number;
  interpretation: string;
}

export const ACTION_PLAN_INTRO = "Use this sheet as the working queue. P1 items should be completed or actively progressed before generic P2 and P3 citations. Authority Score is a third-party diagnostic, not a Google metric; relevance and legitimacy take priority over volume.";

export const GROUP_INTRO = "The counts below describe the supplied Semrush gap rows, not verified high-quality referring domains. They are useful for direction, but spam and syndicated content inflate several competitors.";

export const SKIP_INTRO = "These domains explain why copying every competitor backlink would be harmful or wasteful. Do not disavow links solely because they appear here; this is an acquisition decision, not a penalty diagnosis.";

export const LISTING_PACK_INTRO = "Complete the missing fields once, approve the copy and assets, then reuse the same details everywhere. Consistency of the clinic name, address and phone matters more than creating a large number of weak listings.";

export const TEMPLATE_INTRO = "Personalise the opening sentence and the reason the target is relevant. Never ask an editorial publication simply to give the clinic a backlink.";

export const SOURCE_DATA_SUMMARY = "2,308 unique domains from 3,283 supplied gap rows. Group 4 covers the first 1,500 of 2,597 Semrush prospects; the unexported tail was not analysed. ‘No action’ means no realistic repeatable opportunity was identified from the supplied row, not that the domain is necessarily harmful.";

export const SOURCE_DOMAINS_SHORTLISTED = 39;

export const BACKLINK_GROUPS: GroupSummary[] = [
  {
    "group": "Winchester",
    "gapRows": 441,
    "competitors": [
      "Wessex Skin",
      "Dr Victoria",
      "The Secret Garden Winchester",
      "Hampshire Medical"
    ],
    "rawLeader": "Wessex Skin",
    "leaderStrongRows": 20,
    "conclusion": "Wessex has the strongest genuine editorial pattern. Secret Garden and Dr Victoria provide the most copyable local, directory and accreditation ideas."
  },
  {
    "group": "Bedhampton local",
    "gapRows": 781,
    "competitors": [
      "Sero Aesthetics",
      "Pallant Aesthetics",
      "The Flawless Guru",
      "Perfect Skin Solutions"
    ],
    "rawLeader": "Perfect Skin Solutions",
    "leaderStrongRows": 61,
    "conclusion": "Perfect Skin Solutions dominates legitimate press and industry links. The other clinics mainly surface generic citations, plus large amounts of spam."
  },
  {
    "group": "Hampshire regional",
    "gapRows": 561,
    "competitors": [
      "Rejuvenate Aesthetics Clinic",
      "Just Skin Aesthetic Clinic",
      "Lumineux Aesthetics",
      "Meyer Clinic"
    ],
    "rawLeader": "Meyer Clinic",
    "leaderStrongRows": 54,
    "conclusion": "Meyer has the largest raw profile, but much of it is press-release syndication and low-quality noise. Yell, Save Face and a small number of UK citations are the repeatable assets."
  },
  {
    "group": "National",
    "gapRows": 1500,
    "competitors": [
      "Dr Sophie Shotter",
      "Dr Leah",
      "The Cosmetic Skin Clinic",
      "Harley Street Skin Clinic"
    ],
    "rawLeader": "Harley Street Skin Clinic",
    "leaderStrongRows": 211,
    "conclusion": "Leading clinics separate themselves through editorial citations and expert commentary. Those links must be earned through PR rather than account creation."
  }
];

export const BACKLINK_COMPETITORS: CompetitorRow[] = [
  {
    "group": "Winchester",
    "competitor": "Wessex Skin",
    "domains": 219,
    "strongRows": 20,
    "interpretation": "Best quality in group; substantial editorial and professional links."
  },
  {
    "group": "Winchester",
    "competitor": "Dr Victoria",
    "domains": 249,
    "strongRows": 11,
    "interpretation": "Useful local and directory signals, including Winchester BID."
  },
  {
    "group": "Winchester",
    "competitor": "The Secret Garden Winchester",
    "domains": 179,
    "strongRows": 9,
    "interpretation": "Copyable Yell, Save Face, Tweakments and supplier links."
  },
  {
    "group": "Winchester",
    "competitor": "Hampshire Medical",
    "domains": 153,
    "strongRows": 1,
    "interpretation": "Mostly supplier, software and low-authority domains."
  },
  {
    "group": "Bedhampton local",
    "competitor": "Sero Aesthetics",
    "domains": 162,
    "strongRows": 4,
    "interpretation": "Mainly directories and booking-platform links."
  },
  {
    "group": "Bedhampton local",
    "competitor": "Pallant Aesthetics",
    "domains": 73,
    "strongRows": 0,
    "interpretation": "Weak backlink benchmark in the supplied gap."
  },
  {
    "group": "Bedhampton local",
    "competitor": "The Flawless Guru",
    "domains": 204,
    "strongRows": 5,
    "interpretation": "Yell and local directories mixed with heavy spam."
  },
  {
    "group": "Bedhampton local",
    "competitor": "Perfect Skin Solutions",
    "domains": 759,
    "strongRows": 61,
    "interpretation": "Clear group leader for press, industry and professional links."
  },
  {
    "group": "Hampshire regional",
    "competitor": "Rejuvenate Aesthetics Clinic",
    "domains": 24,
    "strongRows": 0,
    "interpretation": "Very small gap footprint."
  },
  {
    "group": "Hampshire regional",
    "competitor": "Just Skin Aesthetic Clinic",
    "domains": 183,
    "strongRows": 2,
    "interpretation": "Mostly low-authority and platform links."
  },
  {
    "group": "Hampshire regional",
    "competitor": "Lumineux Aesthetics",
    "domains": 78,
    "strongRows": 7,
    "interpretation": "Some useful citations and accreditation signals."
  },
  {
    "group": "Hampshire regional",
    "competitor": "Meyer Clinic",
    "domains": 486,
    "strongRows": 54,
    "interpretation": "Large profile, but inflated by syndication and irrelevant domains."
  },
  {
    "group": "National",
    "competitor": "Dr Sophie Shotter",
    "domains": 651,
    "strongRows": 102,
    "interpretation": "Strong editorial expertise and beauty-media profile."
  },
  {
    "group": "National",
    "competitor": "Dr Leah",
    "domains": 1030,
    "strongRows": 112,
    "interpretation": "Broad press, directories and consumer-treatment platforms."
  },
  {
    "group": "National",
    "competitor": "The Cosmetic Skin Clinic",
    "domains": 141,
    "strongRows": 1,
    "interpretation": "Low representation in this particular supplied gap export."
  },
  {
    "group": "National",
    "competitor": "Harley Street Skin Clinic",
    "domains": 1251,
    "strongRows": 211,
    "interpretation": "Largest raw profile; extensive press coverage plus substantial noise."
  }
];

export const BACKLINK_SKIP_LIST: SkipItem[] = [
  {
    "category": "Competitor-only links",
    "examples": "cqc.org.uk",
    "seenIn": "All groups",
    "why": "Registration is only appropriate if the clinic performs CQC-regulated activities. It cannot be joined for SEO.",
    "reconsider": "Reassess if the service scope becomes regulated."
  },
  {
    "category": "Competitor-only links",
    "examples": "bcam.ac.uk",
    "seenIn": "Winchester and National",
    "why": "BCAM membership is principally for doctors and dentists. Abi is an ANP/IP, so this is unlikely to be eligible.",
    "reconsider": "Only revisit if BCAM confirms an eligible membership route."
  },
  {
    "category": "Competitor-only links",
    "examples": "topdoctors.co.uk",
    "seenIn": "National",
    "why": "Doctor-focused directory; practitioner eligibility is unlikely for a nurse prescriber.",
    "reconsider": "Revisit only after written eligibility confirmation."
  },
  {
    "category": "Competitor-only links",
    "examples": "consentz.com",
    "seenIn": "All groups",
    "why": "Most links arise from clinics using the Consentz platform. Abi uses Aesthetics Nurse Software.",
    "reconsider": "Only if the software relationship changes."
  },
  {
    "category": "Competitor-only links",
    "examples": "fresha.com, setmore.com, pabau.com",
    "seenIn": "Several groups",
    "why": "Booking-platform links belong to customers of those systems and are not independent citation opportunities.",
    "reconsider": "Do not change clinical software for a backlink."
  },
  {
    "category": "Competitor-only links",
    "examples": "sofwave.com, teoxane.co.uk, cellderma.com, cantabrialabs.co.uk",
    "seenIn": "Winchester, Local and National",
    "why": "Manufacturer links are valid only when the clinic genuinely buys, uses or stocks the relevant product or device.",
    "reconsider": "Pursue only after a genuine supplier relationship exists."
  },
  {
    "category": "Competitor-only links",
    "examples": "cpduk.co.uk",
    "seenIn": "Local and National",
    "why": "These links relate mainly to training-provider accreditation, not ordinary clinic work.",
    "reconsider": "Relevant only if the clinic becomes a CPD training provider."
  },
  {
    "category": "Competitor-only links",
    "examples": "groupon.co.uk",
    "seenIn": "Winchester and National",
    "why": "The discount-market positioning conflicts with the premium nurse-led clinical brand and can weaken pricing discipline.",
    "reconsider": "Skip unless the commercial strategy deliberately changes."
  },
  {
    "category": "Low-quality or automated",
    "examples": "endole.co.uk, datagemba.com, opening data scrapers",
    "seenIn": "Several groups",
    "why": "Company-data and scraped-location records are usually created automatically and offer little control or authority.",
    "reconsider": "Correct material errors only."
  },
  {
    "category": "Low-quality or spam",
    "examples": "bye.fyi, analyticshaven.top, metamagic.top, southfwb.com",
    "seenIn": "All groups",
    "why": "These high-overlap domains are automated SEO noise, not evidence that competitors intentionally earned strong links.",
    "reconsider": "Avoid."
  },
  {
    "category": "Low-quality or spam",
    "examples": ".shop, .top, .xyz, .icu and unrelated foreign directories",
    "seenIn": "All groups",
    "why": "The exports contain hundreds of disposable domains, casino pages, URL shorteners and unrelated scraped pages.",
    "reconsider": "Avoid and do not submit the clinic."
  },
  {
    "category": "Low-quality or spam",
    "examples": "backlinksbank.com, buyrankbacklinks.com, firstguestpost.com",
    "seenIn": "Several groups",
    "why": "Explicit link-selling networks create search-engine risk and no patient value.",
    "reconsider": "Avoid."
  },
  {
    "category": "Low-quality or spam",
    "examples": "Blogspot and Web App pages using clinic keywords",
    "seenIn": "All groups",
    "why": "These are machine-generated or copied pages rather than genuine editorial recommendations.",
    "reconsider": "Avoid."
  },
  {
    "category": "Low-value PR syndication",
    "examples": "einpresswire.com and press-release mirror networks",
    "seenIn": "Hampshire and National",
    "why": "Syndication can create many counted domains without the editorial trust of independently reported coverage.",
    "reconsider": "Use only for a genuine announcement, never as the core link strategy."
  },
  {
    "category": "Low-value awards",
    "examples": "ghpnews.digital and generic paid award sites",
    "seenIn": "Local, Hampshire and National",
    "why": "Some award programmes are primarily paid visibility. A badge or article is not automatically a credible endorsement.",
    "reconsider": "Enter only where judging, audience and commercial terms are transparent."
  }
];
