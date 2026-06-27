const form = document.querySelector("#offerForm");
const resultsList = document.querySelector("#resultsList");
const savedList = document.querySelector("#savedList");
const statusStrip = document.querySelector("#statusStrip");
const tabButtons = document.querySelectorAll(".tab-button");
const views = document.querySelectorAll(".view");

const controls = {
  bank: document.querySelector("#bankSelect"),
  vendor: document.querySelector("#vendorSelect"),
  variant: document.querySelector("#variantInput"),
  merchant: document.querySelector("#merchantInput"),
  category: document.querySelector("#categorySelect"),
  amount: document.querySelector("#amountInput"),
  location: document.querySelector("#locationInput"),
};

const API_BASE_URL = window.CARD_OFFERS_API_BASE_URL || "";
const savedOffers = JSON.parse(localStorage.getItem("savedCardOffers") || "[]");

function setStatus(title, detail) {
  statusStrip.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
}

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function buildPayload() {
  return {
    bank: controls.bank.value,
    vendor: controls.vendor.value,
    variant: controls.variant.value.trim(),
    merchant: controls.merchant.value.trim(),
    category: controls.category.value,
    amount: Number(controls.amount.value || 0),
    location: controls.location.value.trim() || "India",
  };
}

function offerId(offer) {
  return [offer.title, offer.merchant, offer.bank, offer.sourceUrl].join("|");
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

  offers.forEach((offer) => {
    const card = document.createElement("article");
    card.className = "offer-card";
    const sourceUrl = String(offer.sourceUrl || "");

    const sourceLink = sourceUrl
      ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Source</a>`
      : `<a href="https://www.google.com/search?q=${encodeURIComponent(`${offer.bank} ${offer.variant} ${offer.merchant} card offer`)}" target="_blank" rel="noreferrer">Search</a>`;

    card.innerHTML = `
      <header>
        <h3>${escapeHtml(offer.title)}</h3>
        <span class="badge">${escapeHtml(offer.confidence || "Estimated")}</span>
      </header>
      <p>${escapeHtml(offer.summary)}</p>
      <div class="meta-row">
        <span>${escapeHtml(offer.bank)}</span>
        <span>${escapeHtml(offer.vendor)}</span>
        <span>${escapeHtml(offer.variant)}</span>
        <span>${escapeHtml(offer.validity || "Check terms")}</span>
      </div>
      <div class="meta-row">
        <span>Expected value: ${currency(offer.estimatedValue)}</span>
        <span>Minimum spend: ${currency(offer.minimumSpend)}</span>
      </div>
      <div class="offer-actions">
        <button type="button" data-save="${offerId(offer)}">Save</button>
        ${sourceLink}
      </div>
    `;

    card.querySelector("[data-save]").addEventListener("click", () => saveOffer(offer));
    container.append(card);
  });
}

function saveOffer(offer) {
  if (!savedOffers.some((item) => offerId(item) === offerId(offer))) {
    savedOffers.unshift(offer);
    localStorage.setItem("savedCardOffers", JSON.stringify(savedOffers.slice(0, 30)));
  }
  renderSaved();
  setStatus("Saved", "Offer saved on this device for quick comparison.");
}

function renderSaved() {
  renderOffers(savedList, savedOffers, "Saved offers will appear here.");
}

async function fetchOffers(payload) {
  const response = await fetch(`${API_BASE_URL}/api/offers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Offer search failed");
  }
  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  const payload = buildPayload();

  button.disabled = true;
  setStatus("Searching", `Checking current ${payload.bank}, ${payload.vendor}, and ${payload.merchant} offer pages.`);

  try {
    const data = await fetchOffers(payload);
    renderOffers(resultsList, data.offers || [], "No offers found. Try another merchant, card variant, or spend amount.");
    setStatus(data.providerLabel || "Search complete", data.summary || "Review source links and bank terms before purchase.");
  } catch (error) {
    setStatus("Offline estimate", "Backend search is unavailable, so the app generated local estimates.");
    renderOffers(resultsList, buildFallbackOffers(payload), "No offers found.");
  } finally {
    button.disabled = false;
  }
});

function buildFallbackOffers(payload) {
  const amount = Number(payload.amount || 0);
  const rate = payload.category === "Travel" ? 0.12 : payload.category === "Dining" ? 0.15 : 0.1;
  const value = Math.min(Math.round(amount * rate), 1500);

  return [
    {
      title: `${payload.bank} ${payload.variant || "card"} ${payload.category.toLowerCase()} offer`,
      summary: `Possible instant discount or reward acceleration for ${payload.merchant || "selected merchants"}. Confirm coupon code, minimum order, and card-network exclusions before checkout.`,
      bank: payload.bank,
      vendor: payload.vendor,
      variant: payload.variant || "Selected card",
      merchant: payload.merchant || payload.category,
      validity: "Live terms required",
      confidence: "Local estimate",
      estimatedValue: value,
      minimumSpend: Math.max(1000, Math.round(amount * 0.7)),
      sourceUrl: "",
    },
  ];
}

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

renderSaved();
renderOffers(resultsList, buildFallbackOffers(buildPayload()), "Start a search to find card offers.");
