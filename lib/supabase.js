// Thin Supabase REST helper used by the API functions.
// Uses the service-role key (server-side only) so it can read/write past RLS.

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured() {
  return Boolean(URL && KEY);
}

function headers(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...extra };
}

async function rest(pathAndQuery, options = {}) {
  const res = await fetch(`${URL}/rest/v1/${pathAndQuery}`, { ...options, headers: headers(options.headers) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return body;
}

// Map a DB row (snake_case) to the shape the front-end expects (camelCase).
export function rowToOffer(r) {
  return {
    id: r.id,
    bank: r.bank,
    cards: r.cards || [],
    networks: r.networks || [],
    category: r.category,
    merchant: r.merchant,
    title: r.title,
    discount: r.discount,
    description: r.description,
    minSpend: r.min_spend,
    maxDiscount: r.max_discount,
    rewardBreakup: r.reward_breakup || [],
    eligibility: r.eligibility,
    howToAvail: r.how_to_avail,
    terms: r.terms || [],
    validFrom: r.valid_from,
    validTill: r.valid_till,
    sourceUrl: r.source_url,
    lastUpdated: r.last_updated,
  };
}

function offerToRow(o) {
  return {
    id: o.id,
    bank: o.bank,
    cards: o.cards || [],
    networks: o.networks || [],
    category: o.category || null,
    merchant: o.merchant || null,
    title: o.title,
    discount: o.discount || null,
    description: o.description || null,
    min_spend: o.minSpend || null,
    max_discount: o.maxDiscount || null,
    reward_breakup: o.rewardBreakup || [],
    eligibility: o.eligibility || null,
    how_to_avail: o.howToAvail || null,
    terms: o.terms || [],
    valid_from: o.validFrom || null,
    valid_till: o.validTill || null,
    source_url: o.sourceUrl || null,
    last_updated: o.lastUpdated || new Date().toISOString().slice(0, 10),
    refreshed_at: new Date().toISOString(),
  };
}

export async function getOffersByBank(bank) {
  const rows = await rest(`offers?bank=eq.${encodeURIComponent(bank)}&select=*`);
  return (rows || []).map(rowToOffer);
}

export async function getSearch(cardKey) {
  const rows = await rest(`searches?card_key=eq.${encodeURIComponent(cardKey)}&select=last_fetched_at`);
  return rows && rows[0] ? rows[0] : null;
}

export async function markSearched(cardKey, selection) {
  await rest("searches?on_conflict=card_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      card_key: cardKey,
      bank: selection.bank,
      variant: selection.variant,
      network: selection.network,
      category: selection.category || null,
      last_fetched_at: new Date().toISOString(),
    }),
  });
}

export async function upsertOffers(offers) {
  if (!offers.length) return;
  await rest("offers?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(offers.map(offerToRow)),
  });
}
