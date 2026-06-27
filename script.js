const form = document.querySelector("#offerForm");
const resultsList = document.querySelector("#resultsList");
const savedList = document.querySelector("#savedList");
const statusStrip = document.querySelector("#statusStrip");
const tabButtons = document.querySelectorAll(".tab-button");
const views = document.querySelectorAll(".view");

const controls = {
  bank: document.querySelector("#bankSelect"),
  variant: document.querySelector("#variantInput"),
  network: document.querySelector("#networkSelect"),
  category: document.querySelector("#categorySelect"),
};

const API_BASE_URL = window.CARD_OFFERS_API_BASE_URL || "";
const savedOffers = JSON.parse(localStorage.getItem("savedCardOffers") || "[]");

function setStatus(title, detail) {
  statusStrip.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
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
    variant: controls.variant.value.trim(),
    network: controls.network.value,
    category: controls.category.value,
  };
}

function offerId(offer) {
  return [offer.title, offer.category, offer.bank, offer.sourceUrl].join("|");
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
      : `<a href="https://www.google.com/search?q=${encodeURIComponent(`${offer.bank} ${offer.variant} ${offer.category} card offer`)}" target="_blank" rel="noreferrer">Search</a>`;

    card.innerHTML = `
      <header>
        <h3>${escapeHtml(offer.title)}</h3>
        <span class="badge">${escapeHtml(offer.confidence || "Estimated")}</span>
      </header>
      <p>${escapeHtml(offer.summary)}</p>
      <div class="meta-row">
        <span>${escapeHtml(offer.bank)}</span>
        <span>${escapeHtml(offer.variant)}</span>
        <span>${escapeHtml(offer.network || offer.vendor || "")}</span>
        <span>${escapeHtml(offer.category || "")}</span>
        <span>${escapeHtml(offer.validity || "Check terms")}</span>
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
  setStatus("Searching", `Checking current ${payload.bank} ${payload.variant} (${payload.network}) ${payload.category} offers.`);

  try {
    const data = await fetchOffers(payload);
    renderOffers(resultsList, data.offers || [], "No offers found. Try a different card variant, network, or category.");
    setStatus(data.providerLabel || "Search complete", data.summary || "Review source links and bank terms before purchase.");
  } catch (error) {
    setStatus("Offline estimate", "Backend search is unavailable, so the app generated local estimates.");
    renderOffers(resultsList, buildFallbackOffers(payload), "No offers found.");
  } finally {
    button.disabled = false;
  }
});

function buildFallbackOffers(payload) {
  return [
    {
      title: `${payload.bank} ${payload.variant || "card"} ${payload.category} offer`,
      summary: `Possible instant discount, cashback, or accelerated rewards on ${payload.category.toLowerCase()} spends. Confirm coupon code, eligible card variant, and card-network exclusions before checkout.`,
      bank: payload.bank,
      network: payload.network,
      variant: payload.variant || "Selected card",
      category: payload.category,
      validity: "Live terms required",
      confidence: "Local estimate",
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
