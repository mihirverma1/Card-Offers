// AI offer pipeline: search the web (Tavily + Firecrawl), then structure the
// findings. Preferred path uses Gemini for clean extraction; if Gemini is
// unavailable (e.g. no quota), we fall back to a heuristic builder that turns
// the relevant search results into offers directly — so the crawler still works.
//
// Search is focused on trustworthy sources: official bank/network provider
// sites and credit-card specialist/aggregator media. News papers, blogs-as-news
// and social/forum/video sites are excluded.

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";

export function aiConfigured() {
  return Boolean(TAVILY_API_KEY || FIRECRAWL_API_KEY);
}

// ---- Source policy -------------------------------------------------------

// Official providers (banks + card networks) and credit-card specialist /
// category-offer media. Search is biased to these.
const PREFERRED_DOMAINS = [
  // Bank / issuer official sites
  "hdfcbank.com", "icicibank.com", "sbicard.com", "axisbank.com", "kotak.com",
  "americanexpress.com", "idfcfirstbank.com", "yesbank.in", "rblbank.com",
  "indusind.com", "sc.com", "hsbc.co.in", "aubank.in",
  // Card networks
  "visa.com", "visa.co.in", "mastercard.com", "mastercard.co.in", "npci.org.in",
  // Credit-card / offer specialist media & aggregators
  "cardexpert.in", "cardinsider.com", "technofino.in", "livefromalounge.com",
  "paisabazaar.com", "bankbazaar.com", "gosaver.in", "magicpin.in",
  "grabon.in", "cashkaro.com", "zingoy.com",
];

// Newspapers / generic news / social — never use these as offer sources.
const EXCLUDE_DOMAINS = [
  // News
  "timesofindia.indiatimes.com", "indiatimes.com", "hindustantimes.com",
  "ndtv.com", "livemint.com", "economictimes.indiatimes.com", "moneycontrol.com",
  "business-standard.com", "thehindu.com", "financialexpress.com", "news18.com",
  "zeebiz.com", "cnbctv18.com", "businesstoday.in", "deccanherald.com",
  // Social / forum / video / scraped-doc dumps
  "instagram.com", "facebook.com", "twitter.com", "x.com", "reddit.com",
  "youtube.com", "youtu.be", "quora.com", "linkedin.com", "pinterest.com",
  "threads.net", "scribd.com",
];

const PREFERRED_RE = new RegExp(PREFERRED_DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|"), "i");
const EXCLUDE_RE = new RegExp(EXCLUDE_DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|"), "i");

const OFFER_SIGNALS =
  /(\boffer\b|\boffers\b|discount|cash\s?back|%\s?off|\bsave\b|\bdeal\b|bonus|voucher|coupon|reward|instant|\bemi\b|\bflat\b|up\s?to|welcome benefit|milestone)/i;
const NOISE_SIGNALS =
  /(apply\s?now|apply\s?for|how\s?to\s?apply|eligibility\s?criteria|documents?\s?required|fees?\s?(and|&)\s?charges|customer\s?care|net\s?banking|\blogin\b|application\s?status)/i;

const CATEGORIES = [
  "Shopping", "Travel", "Dining", "Fuel", "Grocery", "Electronics",
  "Entertainment", "UPI", "Movies", "Insurance", "Utilities",
];

// ---- Search providers ----------------------------------------------------

async function tavilySearch(query, { includeDomains, excludeDomains } = {}) {
  if (!TAVILY_API_KEY) return [];
  try {
    const body = {
      api_key: TAVILY_API_KEY,
      query,
      max_results: 8,
      search_depth: "advanced",
      include_raw_content: true,
    };
    if (includeDomains?.length) body.include_domains = includeDomains;
    if (excludeDomains?.length) body.exclude_domains = excludeDomains;

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: (r.content || "").slice(0, 300),
      content: (r.raw_content || r.content || "").slice(0, 4000),
    }));
  } catch {
    return [];
  }
}

async function firecrawlSearch(query) {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: 8,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.data;
    const items = Array.isArray(raw) ? raw : [...(raw?.web || []), ...(raw?.news || [])];
    return items.map((i) => ({
      url: i.url,
      title: i.title,
      snippet: (i.description || "").slice(0, 300),
      content: (i.markdown || i.description || "").slice(0, 4000),
    }));
  } catch {
    return [];
  }
}

// ---- Helpers -------------------------------------------------------------

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractDiscount(text) {
  const pct = text.match(/(\d{1,2})\s?%\s?(?:instant\s?)?(?:off|discount|cash\s?back|back)/i);
  if (pct) return `${pct[1]}% off / cashback`;
  const flat = text.match(/(?:flat\s?)?(?:rs\.?|₹)\s?(\d{2,5})\s?(?:off|cash\s?back|discount)/i);
  if (flat) return `₹${flat[1]} off`;
  return "See offer details";
}

function guessCategory(text, fallback) {
  for (const c of CATEGORIES) {
    if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
  }
  return fallback || "Shopping";
}

function scorePage(p, sel) {
  const text = `${p.title} ${p.snippet}`;
  let score = 0;
  if (OFFER_SIGNALS.test(text)) score += 2;
  if (/\d{1,2}\s?%/.test(text)) score += 1;
  if (sel.category && new RegExp(`\\b${sel.category}\\b`, "i").test(text)) score += 1;
  if (new RegExp(sel.bank.split(" ")[0], "i").test(text)) score += 1;
  if (NOISE_SIGNALS.test(text)) score -= 2;
  if (/offer|deal/i.test(p.url)) score += 2;
  if (/\/(apply|eligibility|fees|charges)/i.test(p.url)) score -= 2;
  if (PREFERRED_RE.test(p.url)) score += 3; // trust official + specialist sources
  return score;
}

// Keep only allowed sources (official providers / specialist media), never news/social.
function allowedSource(p) {
  return p.url && p.title && !EXCLUDE_RE.test(p.url);
}

// ---- Extraction ----------------------------------------------------------

// Fallback: build offer objects straight from the best search results (no LLM).
function heuristicExtract(pages, sel) {
  return pages
    .filter(allowedSource)
    .map((p) => ({ p, score: scorePage(p, sel) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ p }) => {
      const text = `${p.title} ${p.snippet}`;
      const desc = (p.snippet || p.content || "").replace(/\s+/g, " ").trim().slice(0, 220);
      return {
        title: p.title.slice(0, 140),
        discount: extractDiscount(text),
        description: desc || "Offer found online. Open the source link for full details.",
        category: sel.category || guessCategory(text),
        merchant: "",
        minSpend: "See source",
        maxDiscount: "See source",
        rewardBreakup: [],
        eligibility: `${sel.bank} ${sel.variant} card holders.`,
        howToAvail: "Open the official source link below for full steps and terms.",
        terms: ["Auto-collected from the web — confirm exact terms on the source page."],
        validFrom: "Ongoing",
        validTill: "Check live terms",
        sourceUrl: p.url,
      };
    });
}

async function geminiExtract(sel, pages) {
  if (!GEMINI_API_KEY) return null;
  const context = pages.map((p, i) => `--- SOURCE ${i + 1} (${p.url}) ---\n${p.content}`).join("\n\n");
  const prompt = `You extract current credit-card offers for ONE specific card.
Card: ${sel.bank} ${sel.variant} (${sel.network} network).
${sel.category ? `Focus on the "${sel.category}" category.` : ""}

The sources are official bank/network pages and credit-card specialist sites.
From them, return ONLY a JSON array (no prose). Each item:
{"title":"...","discount":"e.g. 5% cashback","description":"1-2 sentences",
 "category":"Shopping|Travel|Dining|Fuel|Grocery|Electronics|Entertainment|UPI|Movies|Insurance|Utilities",
 "merchant":"...","minSpend":"... or No minimum","maxDiscount":"... or No cap",
 "rewardBreakup":["bullet"],"eligibility":"...","howToAvail":"...","terms":["t&c"],
 "validFrom":"date or Ongoing","validTill":"date or Ongoing","sourceUrl":"the source URL"}
Only REAL offers stated in the sources. Ignore generic 'apply now' marketing and news commentary. If none, return [].

SOURCES:
${context}`;

  const call = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000 } }),
    });

  let res = await call();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await call();
  }
  if (!res.ok) {
    console.error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)} — falling back to heuristic extraction.`);
    return null;
  }
  const data = await res.json();
  const txt = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const match = txt.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

// ---- Orchestration -------------------------------------------------------

export async function aiSearch(sel) {
  const year = new Date().getFullYear();
  const query = `${sel.bank} ${sel.variant} ${sel.network} credit card ${sel.category || ""} offers discount cashback ${year}`;

  // Pass 1: restrict to official providers + specialist media.
  let pages = await tavilySearch(query, { includeDomains: PREFERRED_DOMAINS });
  // Pass 2: if too few, widen but still exclude news/social.
  if (pages.length < 3) {
    pages = pages.concat(await tavilySearch(query, { excludeDomains: EXCLUDE_DOMAINS }));
  }
  // Pass 3: Firecrawl as a top-up, filtered to allowed sources.
  if (pages.length < 3) {
    pages = pages.concat(await firecrawlSearch(query));
  }
  pages = pages.filter(allowedSource);
  if (!pages.length) return [];

  let extracted = await geminiExtract(sel, pages);
  if (!extracted || !extracted.length) extracted = heuristicExtract(pages, sel);

  const today = new Date().toISOString().slice(0, 10);
  return extracted
    .filter((o) => o && o.title)
    .map((o) => ({
      ...o,
      id: `${slug(sel.bank)}-${slug(sel.variant)}-${slug(o.title)}`.slice(0, 90),
      bank: sel.bank,
      cards: [sel.variant],
      networks: [sel.network],
      lastUpdated: today,
    }));
}
