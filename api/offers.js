import { filterOffers } from "../data/offers.js";
import { jsonResponse } from "../lib/http.js";

function clean(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 120);
}

// Returns verified, structured offers for the card the user selected.
// Input (POST JSON): { bank, variant, network, category? }
export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") return jsonResponse(res, 204, {}, origin);
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" }, origin);

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const selection = {
      bank: clean(body.bank),
      variant: clean(body.variant),
      network: clean(body.network || body.issuer || body.vendor),
      category: clean(body.category) || undefined,
    };

    const offers = filterOffers(selection);

    return jsonResponse(
      res,
      200,
      {
        card: selection,
        count: offers.length,
        offers,
        summary: offers.length
          ? `Found ${offers.length} live offer${offers.length > 1 ? "s" : ""} for your card. Tap any offer for full terms.`
          : "No offers listed for this card yet. We refresh offers regularly — check back soon.",
        disclaimer: "Always confirm final terms on the bank's linked page before you spend.",
      },
      origin
    );
  } catch (error) {
    return jsonResponse(res, 500, { error: "Could not load offers", offers: [] }, origin);
  }
}
