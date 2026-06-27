# Card Offers

Pick your credit card (Bank → Variant → Network) and see every live offer on it,
with full terms, validity, eligibility and a link to the official source. No card
details are ever entered — you just select the card you hold.

## How it works (plain English)

1. **You pick your card** in the app.
2. The backend **checks the database (Supabase)** for offers already saved for
   that exact card.
3. **If found and recent**, it returns them instantly (fast + cheap).
4. **If missing or older than a week**, an **AI pipeline** searches the web
   (Tavily + Firecrawl) and **Gemini** turns the findings into clean, structured
   offers, **saves them to the database**, then returns them. Next time, it's a
   fast database read.

## Pieces

| Part | What it is |
| --- | --- |
| Frontend | Static app in `index.html` / `script.js` / `styles.css`, hosted on **Vercel** |
| API | `api/cards.js` (card list) and `api/offers.js` (offers for a card), on Vercel |
| Database | **Supabase** — `offers` table + `searches` freshness ledger |
| AI pipeline | `lib/ai.js` — Tavily + Firecrawl + Gemini |
| Refresh job | `scripts/ingest.mjs` — bulk-refresh offers for every catalog card |
| Card catalog | `data/cards.js` (which cards exist) |
| Built-in seed | `data/offers.js` (fallback offers if the DB/AI isn't configured) |

## Environment variables (set in Vercel)

See `.env.example`. Required for the full pipeline: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY`,
`FIRECRAWL_API_KEY`. Without them the app safely serves the built-in seed offers.

## Refreshing offers in bulk

```bash
export SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...   # optional, to write to DB
export FIRECRAWL_API_KEY=...  TAVILY_API_KEY=...  ANTHROPIC_API_KEY=...
node scripts/ingest.mjs
```

(The on-demand pipeline in `api/offers.js` uses Gemini; the bulk `ingest.mjs`
script currently uses Claude — either can fill the database.)
