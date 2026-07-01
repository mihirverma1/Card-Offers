// Offer pipeline:
//   1. SEARCH the web (Tavily + Firecrawl) for pages about the card's offers.
//   2. EXTRACT structured offers, in this order:
//        a) Firecrawl's own AI extraction (primary)
//        b) an OpenRouter free model reading the scraped text (failsafe)
//        c) Gemini, only if a key is set (optional)
//        d) a no-LLM heuristic (last resort)
//
// Domain include/exclude passes are disabled for now (let the engines decide).

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
// Model used to FETCH offers from the web via Google Search grounding.
const GEMINI_FETCH_MODEL = process.env.GEMINI_FETCH_MODEL || "gemini-2.0-flash";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

export function aiConfigured() {
  return Boolean(TAVILY_API_KEY || FIRECRAWL_API_KEY);
}

const OFFER_SIGNALS =
  /(\boffer\b|\boffers\b|discount|cash\s?back|%\s?off|\bsave\b|\bdeal\b|bonus|voucher|coupon|reward|instant|\bemi\b|\bflat\b|up\s?to|welcome benefit|milestone)/i;
const NOISE_SIGNALS =
  /(apply\s?now|apply\s?for|how\s?to\s?apply|eligibility\s?criteria|documents?\s?required|fees?\s?(and|&)\s?charges|customer\s?care|net\s?banking|\blogin\b|application\s?status|terms\s?(and|&)\s?conditions|\bt&c\b|important\s?update|check\s?(benefits|rewards)\s?online)/i;

const CATEGORIES = [
  "Shopping", "Travel", "Dining", "Fuel", "Grocery", "Electronics",
  "Entertainment", "UPI", "Movies", "Insurance", "Utilities",
];

/* ---------- Search providers ---------- */

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query, max_results: 8, search_depth: "advanced", include_raw_content: true }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({
      url: r.url, title: r.title,
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
      body: JSON.stringify({ query, limit: 8, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.data;
    const items = Array.isArray(raw) ? raw : [...(raw?.web || []), ...(raw?.news || [])];
    return items.map((i) => ({
      url: i.url, title: i.title,
      snippet: (i.description || "").slice(0, 300),
      content: (i.markdown || i.description || "").slice(0, 4000),
    }));
  } catch {
    return [];
  }
}

/* ---------- Shared extraction prompt (the precise data-extraction engine) ---------- */

function extractionRules(sel) {
  return `You are a precise data extraction engine. Your task is to extract active, specific credit card offers for ONE card from the provided text, filter them by category, and rank them to find the best deal.

CARD DETAILS:
- Bank: ${sel.bank}
- Variant: ${sel.variant}
- Network: ${sel.network}
- Target Category: ${sel.category || "Any (include offers from all categories)"}

CRITICAL EXECUTION RULES:
1. Extract ONLY real, specific promotional offers or structural reward milestones stated explicitly in the text.
2. Ignore generic marketing fluff ("Apply now"), baseline non-categorical reward rates, news commentary, or expired deals.
3. Filter strictly by the Target Category. If an offer does not fit the category, exclude it.
4. Sort the resulting JSON array in descending order, placing the absolute "best deal" (highest value, lowest friction, highest discount/cashback rate) as the first element.
5. If no specific offers match the criteria or the text contains no data, return exactly an empty array: []

OUTPUT FORMAT:
Return ONLY a valid JSON array. No markdown code fences, no introductory text, no concluding remarks. The output must start with [ and end with ].

Each object must strictly follow this schema:
{
  "title": "Clear, concise title of the offer",
  "discount": "e.g., 5% cashback, INR 500 off, 10x reward points",
  "description": "1-2 sentences summarizing the offer details",
  "category": "Must be exactly one of: Shopping | Travel | Dining | Fuel | Grocery | Electronics | Entertainment | UPI | Movies | Insurance | Utilities",
  "merchant": "Name of the partner merchant or 'All Merchants' if generic",
  "minSpend": "Minimum transaction value required (e.g., 'INR 2,000') or 'No minimum'",
  "maxDiscount": "Maximum cap on the benefit (e.g., 'INR 500 per month') or 'No cap'",
  "rewardBreakup": ["Array of strings outlining calculation details if complex, or empty array"],
  "eligibility": "Specific conditions required to qualify, or 'All cardholders'",
  "howToAvail": "Step-by-step instructions on how the user claims this specific deal",
  "terms": ["Key terms and conditions like 'Valid once per user', 'Not valid on EMI'"],
  "validFrom": "YYYY-MM-DD or 'Ongoing'",
  "validTill": "YYYY-MM-DD or 'Ongoing'",
  "sourceUrl": "The exact source URL where this offer was found"
}`;
}

function parseJsonArray(text) {
  if (!text) return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* ---------- (a) PRIMARY: Firecrawl AI extraction ---------- */

async function firecrawlExtract(sel, pages) {
  if (!FIRECRAWL_API_KEY) return [];
  const prompt = `${extractionRules(sel)}\n\nExtract the offers from THIS page's content.`;
  const top = pages.slice(0, 3);

  const calls = top.map(async (p) => {
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: p.url, onlyMainContent: true, formats: [{ type: "json", prompt }] }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const json = data?.data?.json ?? data?.json;
      let offers = Array.isArray(json) ? json : json?.offers || [];
      return offers.map((o) => ({ ...o, sourceUrl: o.sourceUrl || p.url }));
    } catch {
      return [];
    }
  });

  const results = await Promise.all(calls);
  return results.flat().filter((o) => o && o.title);
}

/* ---------- (b) FAILSAFE: OpenRouter free model ---------- */

async function openrouterExtract(sel, pages) {
  if (!OPENROUTER_API_KEY) return [];
  const context = pages.map((p, i) => `--- SOURCE ${i + 1} (${p.url}) ---\n${p.content}`).join("\n\n");
  const prompt = `${extractionRules(sel)}\n\nSOURCES:\n${context}`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Card Offers",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return [];
    }
    const data = await res.json();
    return parseJsonArray(data.choices?.[0]?.message?.content || "");
  } catch (e) {
    console.error("OpenRouter error:", e.message);
    return [];
  }
}

/* ---------- (c) OPTIONAL: Gemini (only if a key is set) ---------- */

async function geminiExtract(sel, pages) {
  if (!GEMINI_API_KEY) return [];
  const context = pages.map((p, i) => `--- SOURCE ${i + 1} (${p.url}) ---\n${p.content}`).join("\n\n");
  const prompt = `${extractionRules(sel)}\n\nSOURCES:\n${context}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000 } }) }
    );
    if (!res.ok) {
      console.error(`Gemini ${res.status}: ${(await res.text()).slice(0, 120)}`);
      return [];
    }
    const data = await res.json();
    const txt = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return parseJsonArray(txt);
  } catch {
    return [];
  }
}

/* ---------- (d) LAST RESORT: heuristic ---------- */

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
  for (const c of CATEGORIES) if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
  return fallback || "Shopping";
}

function scorePage(p, sel) {
  const text = `${p.title} ${p.snippet}`;
  let score = 0;
  if (OFFER_SIGNALS.test(text)) score += 2;
  if (/\d{1,2}\s?%/.test(text)) score += 1;
  if (sel.category && new RegExp(`\\b${sel.category}\\b`, "i").test(text)) score += 1;
  if (new RegExp(sel.bank.split(" ")[0], "i").test(text)) score += 1;
  if (NOISE_SIGNALS.test(text)) score -= 3;
  if (/offer|deal/i.test(p.url)) score += 2;
  if (/\/(apply|eligibility|fees|charges|tnc|terms|important-update|login)/i.test(p.url)) score -= 3;
  return score;
}

function heuristicExtract(pages, sel) {
  return pages
    .filter((p) => p.url && p.title)
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

/* ---------- Tag offers to the selected card ---------- */

function tag(offers, sel) {
  const today = new Date().toISOString().slice(0, 10);
  return offers
    .filter((o) => o && o.title)
    .map((o) => ({
      ...o,
      id: `${slug(sel.bank)}-${slug(sel.variant)}-${slug(o.title)}`.slice(0, 90),
      bank: sel.bank,
      cards: [sel.variant],
      networks: [sel.network],
      lastUpdated: o.lastUpdated || today,
    }));
}

/* ---------- PRIMARY: Gemini 2.0 Flash fetches from the web (Google Search) ---------- */

async function geminiFetch(sel) {
  if (!GEMINI_API_KEY) return "";
  const cat = sel.category ? ` in the ${sel.category} category` : "";
  const prompt = `Using live web search, find ALL current, active offers on the ${sel.bank} ${sel.variant} (${sel.network}) credit card${cat}. Include promotional offers, discounts, cashback, reward-point offers, welcome/milestone benefits and merchant tie-ups. Exclude expired deals and generic "apply now" marketing.

For EACH offer, report: the offer title; exactly what you get (discount/cashback/points); the merchant; minimum spend; maximum cap; who is eligible; how to avail it; key terms & conditions; valid-from and valid-till dates; and the source URL. List the best deal first. Be specific and factual — only include offers you actually find on the web.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FETCH_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini fetch ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n");
}

/* ---------- PRIMARY: Llama (OpenRouter) turns the findings into structured offers ---------- */

async function llamaFormat(sel, sourceText) {
  if (!OPENROUTER_API_KEY || !sourceText) return [];
  const prompt = `${extractionRules(sel)}\n\nSOURCE TEXT (research findings about this card's offers):\n${sourceText}`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Card Offers" },
    body: JSON.stringify({ model: OPENROUTER_MODEL, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    console.error(`OpenRouter(format) ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return [];
  }
  const data = await res.json();
  return parseJsonArray(data.choices?.[0]?.message?.content || "");
}

/* ---------- FALLBACK: the scraping pipeline (set aside, kept as a safety net) ---------- */

async function legacyPipeline(sel) {
  const year = new Date().getFullYear();
  const query = `${sel.bank} ${sel.variant} ${sel.network} credit card ${sel.category || ""} offers ${year}`;

  let pages = await tavilySearch(query);
  if (pages.length < 4) pages = pages.concat(await firecrawlSearch(query));

  const seen = new Set();
  pages = pages.filter((p) => {
    if (!p.url || !p.title || seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
  pages = pages.slice(0, 6);
  if (!pages.length) return [];

  let extracted = await firecrawlExtract(sel, pages);
  if (!extracted.length) extracted = await openrouterExtract(sel, pages);
  if (!extracted.length) extracted = await geminiExtract(sel, pages);
  if (!extracted.length) extracted = heuristicExtract(pages, sel);
  return tag(extracted, sel);
}

/* ---------- Orchestration ---------- */

export async function aiSearch(sel) {
  // PRIMARY: Gemini 2.0 Flash fetches offers from the web, Llama formats them.
  if (GEMINI_API_KEY && OPENROUTER_API_KEY) {
    try {
      const findings = await geminiFetch(sel);
      if (findings && findings.trim()) {
        const offers = await llamaFormat(sel, findings);
        if (offers.length) return tag(offers, sel);
      }
    } catch (e) {
      console.error("Gemini+Llama path failed, using fallback:", e.message);
    }
  }
  // FALLBACK: the scraping pipeline.
  return legacyPipeline(sel);
}
