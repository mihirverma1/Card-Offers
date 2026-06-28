// AI offer pipeline: search the web (Tavily + Firecrawl) then structure the
// findings into clean offer objects with Gemini. Runs only when a card's
// offers are missing or stale in the database.

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";

export function aiConfigured() {
  return Boolean(GEMINI_API_KEY && (TAVILY_API_KEY || FIRECRAWL_API_KEY));
}

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      max_results: 6,
      search_depth: "advanced",
      include_raw_content: true,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r) => ({
    url: r.url,
    title: r.title,
    content: (r.raw_content || r.content || "").slice(0, 4000),
  }));
}

async function firecrawlSearch(query) {
  if (!FIRECRAWL_API_KEY) return [];
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: 6,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = data.data;
  const items = Array.isArray(raw) ? raw : [...(raw?.web || []), ...(raw?.news || [])];
  return items.map((i) => ({ url: i.url, title: i.title, content: (i.markdown || i.description || "").slice(0, 4000) }));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function geminiExtract(selection, pages) {
  const today = new Date().toISOString().slice(0, 10);
  const context = pages.map((p, i) => `--- SOURCE ${i + 1} (${p.url}) ---\n${p.content}`).join("\n\n");

  const prompt = `You extract current credit-card offers for ONE specific card.
Card: ${selection.bank} ${selection.variant} (${selection.network} network).
${selection.category ? `Focus on the "${selection.category}" category.` : ""}

From the sources below, return ONLY a JSON array (no prose). Each item:
{
 "title": "...", "discount": "headline e.g. 5% cashback", "description": "1-2 sentences",
 "category": "Shopping|Travel|Dining|Fuel|Grocery|Electronics|Entertainment|UPI|Movies|Insurance|Utilities",
 "merchant": "...", "minSpend": "... or No minimum", "maxDiscount": "... or No cap",
 "rewardBreakup": ["bullet","bullet"], "eligibility": "...", "howToAvail": "...",
 "terms": ["t&c","t&c"], "validFrom": "date or Ongoing", "validTill": "date or Ongoing",
 "sourceUrl": "the source URL"
}
Only include REAL offers actually stated in the sources. Ignore generic 'apply now' marketing. If none, return [].

SOURCES:
${context}`;

  const callGemini = async () => {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
        }),
      }
    );
  };

  let res = await callGemini();
  // Retry once on a transient rate limit.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3000));
    res = await callGemini();
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

// Returns offers normalised and tagged to the selected card, ready to store.
export async function aiSearch(selection) {
  const year = new Date().getFullYear();
  const query = `${selection.bank} ${selection.variant} ${selection.network} credit card ${selection.category || ""} offers discount cashback ${year}`;

  let pages = await tavilySearch(query);
  if (pages.length < 2) pages = pages.concat(await firecrawlSearch(query));
  if (!pages.length) return [];

  const extracted = await geminiExtract(selection, pages);
  const today = new Date().toISOString().slice(0, 10);

  return extracted
    .filter((o) => o && o.title)
    .map((o) => ({
      ...o,
      id: `${slug(selection.bank)}-${slug(selection.variant)}-${slug(o.title)}`.slice(0, 90),
      bank: selection.bank,
      cards: [selection.variant],
      networks: [selection.network],
      lastUpdated: today,
    }));
}
