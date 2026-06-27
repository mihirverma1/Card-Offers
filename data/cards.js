// Card catalog — the list of cards a user can pick from (Bank → Variant → Network).
// This is intentionally a simple, editable list. The offer-refresh pipeline
// (scripts/ingest.mjs) and the app both rely on the bank/variant names here
// matching the names used in data/offers.js.

export const CARDS = [
  // HDFC Bank
  { bank: "HDFC Bank", variant: "Millennia", networks: ["Visa", "Mastercard"] },
  { bank: "HDFC Bank", variant: "Regalia Gold", networks: ["Visa", "Mastercard"] },
  { bank: "HDFC Bank", variant: "Diners Club Black", networks: ["Diners Club"] },
  { bank: "HDFC Bank", variant: "Tata Neu Infinity", networks: ["RuPay", "Visa"] },
  { bank: "HDFC Bank", variant: "Swiggy", networks: ["Mastercard"] },

  // ICICI Bank
  { bank: "ICICI Bank", variant: "Amazon Pay", networks: ["Visa"] },
  { bank: "ICICI Bank", variant: "Coral", networks: ["Visa", "Mastercard", "RuPay"] },
  { bank: "ICICI Bank", variant: "Sapphiro", networks: ["Visa", "Mastercard", "American Express"] },

  // SBI Card
  { bank: "SBI Card", variant: "Cashback", networks: ["Visa", "RuPay"] },
  { bank: "SBI Card", variant: "SimplyCLICK", networks: ["Visa", "Mastercard"] },
  { bank: "SBI Card", variant: "Cashback (RuPay UPI)", networks: ["RuPay"] },

  // Axis Bank
  { bank: "Axis Bank", variant: "Atlas", networks: ["Visa"] },
  { bank: "Axis Bank", variant: "Magnus", networks: ["Mastercard"] },
  { bank: "Axis Bank", variant: "Flipkart", networks: ["Mastercard"] },
  { bank: "Axis Bank", variant: "ACE", networks: ["Visa"] },

  // Kotak Mahindra Bank
  { bank: "Kotak Mahindra Bank", variant: "811 #DreamDifferent", networks: ["RuPay"] },
  { bank: "Kotak Mahindra Bank", variant: "League Platinum", networks: ["Visa", "Mastercard"] },

  // American Express
  { bank: "American Express", variant: "Membership Rewards", networks: ["American Express"] },
  { bank: "American Express", variant: "SmartEarn", networks: ["American Express"] },

  // IDFC FIRST Bank
  { bank: "IDFC FIRST Bank", variant: "Millennia", networks: ["Visa", "RuPay"] },
  { bank: "IDFC FIRST Bank", variant: "Select", networks: ["Visa", "Mastercard"] },
];

// Convenience lookups used by the API and the front-end picker.
export const BANKS = [...new Set(CARDS.map((c) => c.bank))];

export function variantsForBank(bank) {
  return CARDS.filter((c) => c.bank === bank).map((c) => c.variant);
}

export function networksFor(bank, variant) {
  const card = CARDS.find((c) => c.bank === bank && c.variant === variant);
  return card ? card.networks : [];
}
