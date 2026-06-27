import { CARDS, BANKS } from "../data/cards.js";
import { jsonResponse } from "../lib/http.js";

// Returns the card catalog so the app can build the Bank -> Variant -> Network picker.
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") return jsonResponse(res, 204, {}, origin);
  return jsonResponse(res, 200, { banks: BANKS, cards: CARDS }, origin);
}
