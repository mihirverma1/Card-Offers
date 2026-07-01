import { filterOffers } from "../data/offers.js"; // bundled seed (graceful fallback)
import { jsonResponse } from "../lib/http.js";
import {
  supabaseConfigured,
  getOffersByBank,
  getSearch,
  markSearched,
  upsertOffers,
} from "../lib/supabase.js";
import { aiConfigured, aiSearch } from "../lib/ai.js";

const CACHE_DAYS = Number(process.env.OFFERS_CACHE_DAYS || 7);

function clean(value) {
  return String(value ?? "").trim().slice(0, 120);
}

function matches(offer, sel) {
  if (sel.variant && !(offer.cards.includes("all") || offer.cards.includes(sel.variant))) return false;
  if (sel.network && !(offer.networks.includes("all") || offer.networks.includes(sel.network))) return false;
  if (sel.category && offer.category !== sel.category) return false;
  return true;
}

function payload(offers, source, extra = {}) {
  return {
    count: offers.length,
    offers,
    source, // "cache" | "live" | "builtin"
    summary: offers.length
      ? `Found ${offers.length} live offer${offers.length > 1 ? "s" : ""} for your card. Tap any offer for full terms.`
      : "No offers listed for this card yet. We refresh offers regularly — check back soon.",
    disclaimer: "Always confirm final terms on the bank's linked page before you spend.",
    debugEnv: {
      hasGemini: Boolean(process.env.GEMINI_API_KEY),
      hasOpenRouter: Boolean(process.env.OPENROUTER_API_KEY),
      hasTavily: Boolean(process.env.TAVILY_API_KEY),
      hasFirecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
    },
    ...extra,
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") return jsonResponse(res, 204, {}, origin);
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" }, origin);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const sel = {
    bank: clean(body.bank),
    variant: clean(body.variant),
    network: clean(body.network || body.issuer || body.vendor),
    category: clean(body.category) || undefined,
  };

  // No database configured yet -> serve the bundled seed so the app still works.
  if (!supabaseConfigured()) {
    return jsonResponse(res, 200, payload(filterOffers(sel), "builtin"), origin);
  }

  try {
    const cardKey = `${sel.bank}|${sel.variant}|${sel.network}|${sel.category || "all"}`.toLowerCase();
    const search = await getSearch(cardKey);
    const fresh =
      search && Date.now() - new Date(search.last_fetched_at).getTime() < CACHE_DAYS * 86400000;

    let source = "cache";

    // Stale or never fetched -> run the AI pipeline, then remember we did.
    if (!fresh && aiConfigured()) {
      source = "live";
      try {
        const found = await aiSearch(sel);
        if (found.length) await upsertOffers(found);
        await markSearched(cardKey, sel);
      } catch (err) {
        // If the AI step fails, fall through and serve whatever is already stored.
        source = "cache";
        console.error("AI pipeline failed:", err.message);
      }
    }

    const dbOffers = (await getOffersByBank(sel.bank)).filter((o) => matches(o, sel));
    if (dbOffers.length) {
      return jsonResponse(res, 200, payload(dbOffers, source), origin);
    }

    // Nothing in the DB for this card -> last-resort bundled seed.
    return jsonResponse(res, 200, payload(filterOffers(sel), "builtin"), origin);
  } catch (err) {
    // Any DB error -> never break the app; serve the seed.
    return jsonResponse(res, 200, payload(filterOffers(sel), "builtin"), origin);
  }
}
