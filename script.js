const API_BASE_URL = window.CARD_OFFERS_API_BASE_URL || "";

const els = {
  form: document.querySelector("#cardForm"),
  bank: document.querySelector("#bankSelect"),
  variant: document.querySelector("#variantSelect"),
  network: document.querySelector("#networkSelect"),
  category: document.querySelector("#categorySelect"),
  results: document.querySelector("#resultsList"),
  status: document.querySelector("#statusStrip"),
  saved: document.querySelector("#savedList"),
  detailBody: document.querySelector("#detailBody"),
  back: document.querySelector("#backToList"),
};

const tabButtons = document.querySelectorAll(".tab-button");
const views = document.querySelectorAll(".view");

let CATALOG = []; // [{ bank, variant, networks }]
let lastOffers = []; // offers currently on screen, for detail lookup
const savedOffers = JSON.parse(localStorage.getItem("savedCardOffers") || "[]");

function setStatus(title, detail) {
  els.status.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

function offerKey(offer) {
  return offer.id || [offer.title, offer.bank, offer.sourceUrl].join("|");
}

/* ---------- Card catalog (Bank -> Variant -> Network) ---------- */

async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cards`);
    const data = await res.json();
    CATALOG = data.cards || [];
  } catch {
    CATALOG = [];
  }
  if (!CATALOG.length) {
    setStatus("Couldn't load cards", "Check your connection and reopen the app.");
    return;
  }
  populateBanks();
}

function fillSelect(select, options) {
  select.innerHTML = options.map((o) => `<option>${escapeHtml(o)}</option>`).join("");
}

function populateBanks() {
  fillSelect(els.bank, [...new Set(CATALOG.map((c) => c.bank))]);
  populateVariants();
}

function populateVariants() {
  const variants = CATALOG.filter((c) => c.bank === els.bank.value).map((c) => c.variant);
  fillSelect(els.variant, variants);
  populateNetworks();
}

function populateNetworks() {
  const card = CATALOG.find((c) => c.bank === els.bank.value && c.variant === els.variant.value);
  fillSelect(els.network, card ? card.networks : []);
}

els.bank.addEventListener("change", populateVariants);
els.variant.addEventListener("change", populateNetworks);

/* ---------- Offers ---------- */

function offerCard(offer) {
  const card = document.createElement("article");
  card.className = "offer-card";
  card.innerHTML = `
    <header>
      <h3>${escapeHtml(offer.title)}</h3>
      <span class="badge">${escapeHtml(offer.discount || offer.category || "Offer")}</span>
    </header>
    <p>${escapeHtml(offer.description || "")}</p>
    <div class="meta-row">
      <span>🏷️ ${escapeHtml(offer.category || "")}</span>
      ${offer.merchant ? `<span>🛍️ ${escapeHtml(offer.merchant)}</span>` : ""}
      <span>🗓️ Valid: ${escapeHtml(offer.validTill || "Check terms")}</span>
    </div>
    <div class="offer-actions">
      <button type="button" data-save>Save</button>
      <button type="button" class="detail-btn" data-detail>View details →</button>
    </div>
  `;
  card.querySelector("[data-detail]").addEventListener("click", () => showDetail(offer));
  card.querySelector("[data-save]").addEventListener("click", () => saveOffer(offer));
  return card;
}

function renderOffers(container, offers, emptyText) {
  container.innerHTML = "";
  if (!offers.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  offers.forEach((offer) => container.append(offerCard(offer)));
}

function bullets(items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function detailRow(label, value) {
  if (!value) return "";
  return `<div class="detail-row"><span class="detail-label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function showDetail(offer) {
  const validity =
    offer.validFrom && offer.validFrom !== "Ongoing"
      ? `${offer.validFrom} → ${offer.validTill || "—"}`
      : offer.validTill || "Ongoing";

  const source = offer.sourceUrl
    ? `<a class="primary-button wide" href="${escapeHtml(offer.sourceUrl)}" target="_blank" rel="noreferrer">Open official offer page</a>`
    : "";

  els.detailBody.innerHTML = `
    <span class="badge">${escapeHtml(offer.discount || "Offer")}</span>
    <h2>${escapeHtml(offer.title)}</h2>
    <p class="detail-card-line">${escapeHtml(offer.bank)} · ${escapeHtml(offer.cards ? offer.cards.join(", ") : "")}</p>
    <p>${escapeHtml(offer.description || "")}</p>

    ${offer.rewardBreakup ? `<h3>What you get</h3>${bullets(offer.rewardBreakup)}` : ""}

    <h3>Key details</h3>
    <div class="detail-grid">
      ${detailRow("Category", offer.category)}
      ${detailRow("Merchant", offer.merchant)}
      ${detailRow("Minimum spend", offer.minSpend)}
      ${detailRow("Maximum benefit", offer.maxDiscount)}
      ${detailRow("Valid", validity)}
    </div>

    ${offer.eligibility ? `<h3>Who can use it</h3><p>${escapeHtml(offer.eligibility)}</p>` : ""}
    ${offer.howToAvail ? `<h3>How to avail</h3><p>${escapeHtml(offer.howToAvail)}</p>` : ""}
    ${offer.terms ? `<h3>Terms &amp; conditions</h3>${bullets(offer.terms)}` : ""}

    ${source}
    <p class="fine-print">Last updated: ${escapeHtml(offer.lastUpdated || "—")}. Offers change often — always confirm the current terms on the official page above before you spend.</p>
  `;
  showView("detailView");
  els.detailBody.scrollTop = 0;
}

els.back.addEventListener("click", () => showView("finderView"));

/* ---------- Saved ---------- */

function saveOffer(offer) {
  if (!savedOffers.some((item) => offerKey(item) === offerKey(offer))) {
    savedOffers.unshift(offer);
    localStorage.setItem("savedCardOffers", JSON.stringify(savedOffers.slice(0, 50)));
    setStatus("Saved", "Added to your saved offers.");
  } else {
    setStatus("Already saved", "This offer is already in your saved list.");
  }
  renderSaved();
}

function renderSaved() {
  renderOffers(els.saved, savedOffers, "Saved offers will appear here. Tap Save on any offer.");
}

/* ---------- Search ---------- */

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = els.form.querySelector("button[type='submit']");
  const payload = {
    bank: els.bank.value,
    variant: els.variant.value,
    network: els.network.value,
    category: els.category.value || undefined,
  };

  button.disabled = true;
  setStatus("Loading", `Finding offers for your ${payload.bank} ${payload.variant} (${payload.network}).`);

  try {
    const res = await fetch(`${API_BASE_URL}/api/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    lastOffers = data.offers || [];
    renderOffers(els.results, lastOffers, "No offers listed for this card yet. We refresh offers regularly — check back soon.");
    setStatus(
      lastOffers.length ? `${lastOffers.length} offer${lastOffers.length > 1 ? "s" : ""} found` : "No offers yet",
      data.summary || ""
    );
  } catch (error) {
    renderOffers(els.results, [], "Couldn't load offers. Check your connection and try again.");
    setStatus("Connection problem", "We couldn't reach the offers service. Please try again.");
  } finally {
    button.disabled = false;
  }
});

/* ---------- Tabs ---------- */

function showView(viewId) {
  views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  tabButtons.forEach((button) => {
    const active = button.dataset.view === viewId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

/* ---------- Init ---------- */

renderSaved();
loadCatalog();
