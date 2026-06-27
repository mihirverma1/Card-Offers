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
  return [
    input.bank,
    input.variant,
    input.vendor,
    input.merchant,
    input.category,
    "credit card offer coupon discount cashback",
    input.location,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_QUERY_LENGTH);
}

function parseInput(body) {
  const input = {
    bank: clean(body.bank, "HDFC Bank"),
    vendor: clean(body.vendor, "Visa"),
    variant: clean(body.variant, "Selected card"),
    merchant: clean(body.merchant, "online merchants"),
    category: clean(body.category, "Shopping"),
    location: clean(body.location, "India"),
    amount: Number(body.amount || 0),
  };

  if (!Number.isFinite(input.amount) || input.amount < 0) input.amount = 0;
  return input;
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

function offerValue(input, text) {
  const amount = Number(input.amount || 0);
  const percentMatch = text.match(/(\d{1,2})\s?%/);
  const capMatch = text.match(/(?:up to|upto|max(?:imum)?|cap(?:ped)? at|rs\.?|₹)\s?(\d{2,6})/i);
  const percent = percentMatch ? Number(percentMatch[1]) / 100 : defaultRate(input.category);
  const cap = capMatch ? Number(capMatch[1]) : defaultCap(input.category);
  return Math.max(0, Math.min(Math.round(amount * percent), cap));
}

function defaultRate(category) {
  const rates = {
    Dining: 0.15,
    Travel: 0.12,
    Electronics: 0.1,
    Shopping: 0.1,
    Grocery: 0.08,
    Fuel: 0.04,
    Entertainment: 0.12,
  };
  return rates[category] || 0.08;
}

function defaultCap(category) {
  return category === "Fuel" ? 250 : category === "Dining" ? 1000 : 1500;
}

function normalizeOffers(search, input) {
  const seen = new Set();
  const offers = [];

  for (const result of search.results) {
    const title = clean(result.title, `${input.bank} card offer`);
    const url = safeUrl(result.url);
    const snippet = clean(result.snippet, "Offer details found online. Verify card eligibility, coupon code, exclusions, and current validity.");
    const key = `${title}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const text = `${title} ${snippet}`;
    offers.push({
      title,
      summary: snippet.length > 155 ? `${snippet.slice(0, 152)}...` : snippet,
      bank: input.bank,
      vendor: input.vendor,
      variant: input.variant,
      merchant: input.merchant,
      validity: /valid|expires|till|until/i.test(text) ? "Validity mentioned in source" : "Check live terms",
      confidence: search.provider === "firecrawl" ? "Crawled" : "Search result",
      estimatedValue: offerValue(input, text),
      minimumSpend: Math.max(500, Math.round((input.amount || 1000) * 0.7)),
      sourceUrl: url,
    });
  }

  return offers.slice(0, 6);
}

function localOffers(input) {
  const baseValue = Math.min(Math.round((input.amount || 5000) * defaultRate(input.category)), defaultCap(input.category));
  return [
    {
      title: `${input.bank} ${input.variant} ${input.category.toLowerCase()} benefit`,
      summary: `Estimated instant discount, cashback, or accelerated reward points for ${input.merchant}. Confirm coupon code, eligible card variant, and network exclusions on checkout.`,
      bank: input.bank,
      vendor: input.vendor,
      variant: input.variant,
      merchant: input.merchant,
      validity: "Live terms required",
      confidence: "Offline estimate",
      estimatedValue: baseValue,
      minimumSpend: Math.max(500, Math.round((input.amount || 1000) * 0.7)),
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
