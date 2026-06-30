const API_BASE_URL = window.CARD_OFFERS_API_BASE_URL || "";

const els = {
  form: document.querySelector("#cardForm"),
  bank: document.querySelector("#bankInput"),
  variant: document.querySelector("#variantInput"),
  network: document.querySelector("#networkInput"),
  category: document.querySelector("#categoryInput"),
  results: document.querySelector("#resultsList"),
  status: document.querySelector("#statusStrip"),
  saved: document.querySelector("#savedList"),
  detailBody: document.querySelector("#detailBody"),
  back: document.querySelector("#backToList"),
  bankList: document.querySelector("#bankList"),
  variantList: document.querySelector("#variantList"),
};

const tabButtons = document.querySelectorAll(".royal-tab");
const views = document.querySelectorAll(".view");

let lastOffers = [];
const savedOffers = JSON.parse(localStorage.getItem("savedCardOffers") || "[]");

const ALERT_ICON =
  '<svg class="royal-icon-glow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f3d98b" stroke-width="2"><path d="M12 2 2 21h20L12 2z"/><path d="M12 9v5M12 17h.01"/></svg>';

function setStatus(title, detail) {
  els.status.innerHTML = `${ALERT_ICON}<div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
  });
}

function offerKey(offer) {
  return offer.id || [offer.title, offer.bank, offer.sourceUrl].join("|");
}

/* ---------- Autocomplete suggestions (still free-text inputs) ---------- */

async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cards`);
    const data = await res.json();
    const cards = data.cards || [];
    const banks = [...new Set(cards.map((c) => c.bank))];
    const variants = [...new Set(cards.map((c) => c.variant))];
    els.bankList.innerHTML = banks.map((b) => `<option value="${escapeHtml(b)}"></option>`).join("");
    els.variantList.innerHTML = variants.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
  } catch {
    /* suggestions are optional — inputs still work as free text */
  }
}

/* ---------- Offers ---------- */

function offerCard(offer) {
  const card = document.createElement("article");
  card.className = "royal-card offer-card";
  card.innerHTML = `
    <div class="offer-head">
      <h2 class="royal-card-title">${escapeHtml(offer.title)}</h2>
      <span class="offer-badge">${escapeHtml(offer.discount || offer.category || "Offer")}</span>
    </div>
    <p class="royal-card-body">${escapeHtml(offer.description || "")}</p>
    <div class="offer-meta">
      <span>🏷 ${escapeHtml(offer.category || "")}</span>
      ${offer.merchant ? `<span>🛍 ${escapeHtml(offer.merchant)}</span>` : ""}
      <span>🗓 ${escapeHtml(offer.validTill || "Check terms")}</span>
    </div>
    <div class="offer-actions">
      <button class="royal-btn-ghost" type="button" data-save>Save</button>
      <button class="royal-btn" type="button" data-detail><span>View details →</span></button>
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
  return `<div class="detail-row"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(value)}</span></div>`;
}

function showDetail(offer) {
  const validity =
    offer.validFrom && offer.validFrom !== "Ongoing"
      ? `${offer.validFrom} → ${offer.validTill || "—"}`
      : offer.validTill || "Ongoing";
  const source = offer.sourceUrl
    ? `<a class="royal-btn royal-btn--block" href="${escapeHtml(offer.sourceUrl)}" target="_blank" rel="noreferrer" style="margin-top:20px"><span>Open official offer page</span></a>`
    : "";

  els.detailBody.innerHTML = `
    <span class="offer-badge">${escapeHtml(offer.discount || "Offer")}</span>
    <h2 class="royal-card-title">${escapeHtml(offer.title)}</h2>
    <p class="detail-cardline">${escapeHtml(offer.bank || "")} · ${escapeHtml(offer.cards ? offer.cards.join(", ") : "")}</p>
    <p class="royal-card-body">${escapeHtml(offer.description || "")}</p>
    ${offer.rewardBreakup && offer.rewardBreakup.length ? `<h3 class="detail-h">What you get</h3>${bullets(offer.rewardBreakup)}` : ""}
    <h3 class="detail-h">Key details</h3>
    <div class="detail-grid">
      ${detailRow("Category", offer.category)}
      ${detailRow("Merchant", offer.merchant)}
      ${detailRow("Minimum spend", offer.minSpend)}
      ${detailRow("Maximum benefit", offer.maxDiscount)}
      ${detailRow("Valid", validity)}
    </div>
    ${offer.eligibility ? `<h3 class="detail-h">Who can use it</h3><p class="royal-card-body" style="margin-top:0">${escapeHtml(offer.eligibility)}</p>` : ""}
    ${offer.howToAvail ? `<h3 class="detail-h">How to avail</h3><p class="royal-card-body" style="margin-top:0">${escapeHtml(offer.howToAvail)}</p>` : ""}
    ${offer.terms && offer.terms.length ? `<h3 class="detail-h">Terms &amp; conditions</h3>${bullets(offer.terms)}` : ""}
    ${source}
    <p class="detail-fine">Last updated: ${escapeHtml(offer.lastUpdated || "—")}. Offers change often — confirm current terms on the official page before you spend.</p>
  `;
  showView("detailView");
  window.scrollTo(0, 0);
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
    bank: els.bank.value.trim(),
    variant: els.variant.value.trim(),
    network: els.network.value.trim(),
    category: els.category.value.trim() || undefined,
  };

  if (!payload.bank || !payload.variant || !payload.network) {
    setStatus("Almost there", "Please enter your bank, card variant and network.");
    return;
  }

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
  tabButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.view === viewId));
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

/* ---------- Init ---------- */

renderSaved();
loadCatalog();
