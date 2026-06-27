const MAX_QUERY_LENGTH = 240;

function jsonResponse(res, status, body, origin) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(origin));
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}

function getAllowedOrigin(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin || allowed.length === 0) return "*";
  // Native app WebViews (Android/iOS load from file://) send "Origin: null".
  // Echo it back so the packaged APK can call the API while the website stays
  // locked to its allow-list.
  if (origin === "null") return "null";
  return allowed.includes(origin) ? origin : allowed[0];
}

function clean(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 180);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function buildQuery(input) {
  const year = new Date().getFullYear();
  return [
    input.bank,
    input.variant,
    input.network,
    "credit card",
    input.category,
    "offers discount cashback",
    year,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_QUERY_LENGTH);
}

function parseInput(body) {
  return {
    bank: clean(body.bank, "HDFC Bank"),
    network: clean(body.network || body.issuer || body.vendor, "Visa"),
    variant: clean(body.variant, "Selected card"),
    category: clean(body.category, "Shopping"),
  };
}

async function firecrawlSearch(query) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is missing");

  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 6,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 86400000,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Firecrawl search failed");
  // Firecrawl v2 /search returns data.data either as a flat array or as an
  // object keyed by source ({ web: [...], news: [...], images: [...] }).
  const raw = data.data;
  const items = Array.isArray(raw)
    ? raw
    : [...(raw?.web || []), ...(raw?.news || [])];
  return {
    provider: "firecrawl",
    providerLabel: "Firecrawl search complete",
    results: items.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description || item.markdown || item.snippet || "",
    })),
  };
}

async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is missing");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 6,
      include_answer: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Tavily search failed");
  return {
    provider: "tavily",
    providerLabel: "Tavily search complete",
    results: (data.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content || "",
    })),
  };
}

async function serpApiSearch(query) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("SERPAPI_API_KEY is missing");

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: "6",
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "SerpAPI search failed");
  return {
    provider: "serpapi",
    providerLabel: "SerpAPI search complete",
    results: (data.organic_results || []).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet || "",
    })),
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Words that signal an actual offer/deal vs. a generic product or apply page.
const OFFER_SIGNALS =
  /(\boffer\b|\boffers\b|discount|cash\s?back|%\s?off|\bsave\b|\bdeal\b|bonus|voucher|coupon|reward|instant|\bemi\b|\bflat\b|up\s?to|welcome benefit|milestone)/i;
// Words that signal a page we usually do NOT want (application/marketing/support).
const NOISE_SIGNALS =
  /(apply\s?now|apply\s?for|how\s?to\s?apply|eligibility|documents?\s?required|fees?\s?(and|&)\s?charges|annual\s?fee|customer\s?care|net\s?banking|\blogin\b|application\s?status|compare\s?cards)/i;

// Rank a search result by how likely it is to be a real, relevant offer.
function scoreResult(text, input) {
  let score = 0;
  if (OFFER_SIGNALS.test(text)) score += 2;
  if (/\d{1,2}\s?%/.test(text)) score += 1; // an explicit percentage
  if (new RegExp(escapeRegExp(input.category), "i").test(text)) score += 1;
  if (new RegExp(escapeRegExp(input.bank), "i").test(text)) score += 1;
  if (NOISE_SIGNALS.test(text)) score -= 2;
  return score;
}

function normalizeOffers(search, input) {
  const seen = new Set();
  const scored = [];

  for (const result of search.results) {
    const title = clean(result.title, `${input.bank} card offer`);
    const url = safeUrl(result.url);
    const snippet = clean(
      result.snippet,
      "Offer details found online. Verify card eligibility, coupon code, exclusions, and current validity."
    );
    const key = `${title}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const text = `${title} ${snippet}`;
    scored.push({
      score: scoreResult(text, input),
      offer: {
        title,
        summary: snippet.length > 200 ? `${snippet.slice(0, 197)}...` : snippet,
        bank: input.bank,
        network: input.network,
        variant: input.variant,
        category: input.category,
        validity: /valid|expires|till|until|last date/i.test(text)
          ? "Validity mentioned in source"
          : "Check live terms",
        confidence: search.provider === "firecrawl" ? "Crawled" : "Search result",
        sourceUrl: url,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  // Prefer results that actually look like offers; if none score positively,
  // fall back to the top results rather than showing nothing.
  const relevant = scored.filter((item) => item.score > 0);
  return (relevant.length ? relevant : scored).slice(0, 6).map((item) => item.offer);
}

function localOffers(input) {
  return [
    {
      title: `${input.bank} ${input.variant} ${input.category} offer`,
      summary: `Look for instant discounts, cashback, or accelerated rewards on ${input.category.toLowerCase()} spends with your ${input.bank} ${input.variant} (${input.network}) card. Confirm coupon code, eligible card variant, and network exclusions at checkout.`,
      bank: input.bank,
      network: input.network,
      variant: input.variant,
      category: input.category,
      validity: "Live terms required",
      confidence: "Offline estimate",
      sourceUrl: "",
    },
  ];
}

async function runSearch(query) {
  const errors = [];
  for (const provider of [firecrawlSearch, tavilySearch, serpApiSearch]) {
    try {
      return await provider(query);
    } catch (error) {
      errors.push(error.message);
    }
  }
  return {
    provider: "offline",
    providerLabel: "Offline estimate",
    results: [],
    errors,
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") return jsonResponse(res, 204, {}, origin);
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" }, origin);

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const input = parseInput(body);
    const query = buildQuery(input);
    const search = await runSearch(query);
    const offers = search.provider === "offline" ? localOffers(input) : normalizeOffers(search, input);

    return jsonResponse(res, 200, {
      offers: offers.length ? offers : localOffers(input),
      provider: search.provider,
      providerLabel: search.providerLabel,
      summary:
        search.provider === "offline"
          ? "No crawler key is configured. Showing local estimates until backend search credentials are added."
          : `Found ${offers.length} possible offers. Verify bank terms before checkout.`,
      query,
    }, origin);
  } catch (error) {
    return jsonResponse(res, 500, {
      error: "Offer search failed",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    }, origin);
  }
}
