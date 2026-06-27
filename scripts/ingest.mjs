// ---------------------------------------------------------------------------
// OFFER REFRESH PIPELINE
//
// This is the "back end" you described: it crawls offer pages with Firecrawl,
// asks an AI (Claude) to read them and pull out clean, structured offers, and
// writes them into data/offers.js — the database the app reads from.
//
// HOW TO RUN (from the project folder):
//   1. Set two keys in your shell:
//        export FIRECRAWL_API_KEY="fc-..."
//        export ANTHROPIC_API_KEY="sk-ant-..."
//   2. Run:
//        node scripts/ingest.mjs
//   3. Review the changes, then commit & push to publish.
//
// Tip: run this on a schedule (e.g. weekly) to keep offers current.
// ---------------------------------------------------------------------------

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CARDS } from "../data/cards.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.INGEST_MODEL || "claude-sonnet-4-6";
const RESULTS_PER_CARD = Number(process.env.INGEST_RESULTS || 6);

if (!FIRECRAWL_API_KEY || !ANTHROPIC_API_KEY) {
  console.error("Missing FIRECRAWL_API_KEY and/or ANTHROPIC_API_KEY. See the comment at the top of this file.");
  process.exit(1);
}

const SCHEMA_HINT = `Return ONLY a JSON array (no prose) of offer objects with these exact keys:
{
  "id": "kebab-case-unique-id",
  "bank": "<exact bank name given>",
  "cards": ["<exact variant name given>"],
  "networks": ["Visa" | "Mastercard" | "RuPay" | "American Express" | "Diners Club"],
  "category": "Shopping|Travel|Dining|Fuel|Grocery|Electronics|Entertainment|UPI|Movies|Insurance|Utilities",
  "merchant": "string",
  "title": "short headline",
  "discount": "headline benefit e.g. '5% cashback'",
  "description": "1-2 sentence summary",
  "minSpend": "string or 'No minimum'",
  "maxDiscount": "string or 'No cap'",
  "rewardBreakup": ["bullet", "bullet"],
  "eligibility": "who qualifies",
  "howToAvail": "how to use the offer",
  "terms": ["t&c bullet", "t&c bullet"],
  "validFrom": "date or 'Ongoing'",
  "validTill": "date or 'Ongoing'",
  "sourceUrl": "the page URL the offer came from",
  "lastUpdated": "${new Date().toISOString().slice(0, 10)}"
}
Only include REAL offers clearly stated on the pages. Skip generic 'apply for card' marketing. If nothing concrete is found, return [].`;

async function firecrawlSearch(query) {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: RESULTS_PER_CARD,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Firecrawl search failed");
  const raw = data.data;
  const items = Array.isArray(raw) ? raw : [...(raw?.web || []), ...(raw?.news || [])];
  return items;
}

async function extractOffers(card, pages) {
  const context = pages
    .map((p, i) => `--- PAGE ${i + 1} (${p.url}) ---\n${(p.markdown || p.description || "").slice(0, 4000)}`)
    .join("\n\n");

  const prompt = `You are extracting current credit-card offers for this exact card:
Bank: ${card.bank}
Variant: ${card.variant}
Networks available: ${card.networks.join(", ")}

From the page content below, extract the real, current offers on this card.
${SCHEMA_HINT}

PAGE CONTENT:
${context}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Claude request failed");
  const text = (data.content || []).map((c) => c.text || "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    console.warn(`  ! Could not parse AI output for ${card.bank} ${card.variant}`);
    return [];
  }
}

async function main() {
  const all = [];
  const seen = new Set();

  for (const card of CARDS) {
    const query = `${card.bank} ${card.variant} credit card offers discount cashback ${new Date().getFullYear()}`;
    process.stdout.write(`Crawling: ${card.bank} ${card.variant} ... `);
    try {
      const pages = await firecrawlSearch(query);
      const offers = await extractOffers(card, pages);
      let added = 0;
      for (const offer of offers) {
        const id = offer.id || `${card.bank}-${card.variant}-${offer.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (seen.has(id)) continue;
        seen.add(id);
        all.push({ ...offer, id });
        added += 1;
      }
      console.log(`${added} offer(s)`);
    } catch (error) {
      console.log(`failed (${error.message})`);
    }
  }

  const header = `// AUTO-GENERATED by scripts/ingest.mjs on ${new Date().toISOString()}.
// Do not hand-edit unless you know what you're doing — re-running ingest overwrites this file.

export const OFFERS = ${JSON.stringify(all, null, 2)};

export function filterOffers({ bank, variant, network, category } = {}) {
  return OFFERS.filter((offer) => {
    if (bank && offer.bank !== bank) return false;
    if (variant && !(offer.cards.includes("all") || offer.cards.includes(variant))) return false;
    if (network && !(offer.networks.includes("all") || offer.networks.includes(network))) return false;
    if (category && offer.category !== category) return false;
    return true;
  });
}
`;

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "offers.js");
  await writeFile(outPath, header, "utf8");
  console.log(`\nWrote ${all.length} offers to data/offers.js`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
