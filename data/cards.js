// Card catalog — the list of cards a user can pick from (Bank → Variant → Network).
// This is intentionally a simple, editable list. The offer-refresh pipeline
// (scripts/ingest.mjs) and the app both rely on the bank/variant names here
// matching the names used in data/offers.js.

export const CARDS = [
  // HDFC Bank
  { bank: "HDFC Bank", variant: "Millennia", networks: ["Visa", "Mastercard"] },
  { bank: "HDFC Bank", variant: "MoneyBack+", networks: ["Visa", "Mastercard"] },
  { bank: "HDFC Bank", variant: "Regalia Gold", networks: ["Visa", "Mastercard"] },
  { bank: "HDFC Bank", variant: "Diners Club Black", networks: ["Diners Club"] },
  { bank: "HDFC Bank", variant: "Infinia", networks: ["Visa", "Mastercard"] },
  { bank: "HDFC Bank", variant: "Tata Neu Infinity", networks: ["RuPay", "Visa"] },
  { bank: "HDFC Bank", variant: "Tata Neu Plus", networks: ["RuPay", "Visa"] },
  { bank: "HDFC Bank", variant: "Swiggy", networks: ["Mastercard"] },
  { bank: "HDFC Bank", variant: "IndianOil", networks: ["RuPay"] },
  { bank: "HDFC Bank", variant: "Marriott Bonvoy", networks: ["Diners Club"] },

  // ICICI Bank
  { bank: "ICICI Bank", variant: "Amazon Pay", networks: ["Visa"] },
  { bank: "ICICI Bank", variant: "Coral", networks: ["Visa", "Mastercard", "RuPay"] },
  { bank: "ICICI Bank", variant: "Rubyx", networks: ["Visa", "Mastercard"] },
  { bank: "ICICI Bank", variant: "Sapphiro", networks: ["Visa", "Mastercard", "American Express"] },
  { bank: "ICICI Bank", variant: "Emeralde Private Metal", networks: ["Visa", "American Express"] },
  { bank: "ICICI Bank", variant: "HPCL Super Saver", networks: ["Visa"] },

  // SBI Card
  { bank: "SBI Card", variant: "Cashback", networks: ["Visa", "RuPay"] },
  { bank: "SBI Card", variant: "SimplyCLICK", networks: ["Visa", "Mastercard"] },
  { bank: "SBI Card", variant: "SimplySAVE", networks: ["Visa", "Mastercard"] },
  { bank: "SBI Card", variant: "PRIME", networks: ["Visa", "Mastercard", "American Express"] },
  { bank: "SBI Card", variant: "ELITE", networks: ["Visa", "Mastercard", "American Express"] },
  { bank: "SBI Card", variant: "IRCTC RuPay", networks: ["RuPay"] },

  // Axis Bank
  { bank: "Axis Bank", variant: "Atlas", networks: ["Visa"] },
  { bank: "Axis Bank", variant: "Magnus", networks: ["Mastercard"] },
  { bank: "Axis Bank", variant: "Reserve", networks: ["Mastercard"] },
  { bank: "Axis Bank", variant: "Flipkart", networks: ["Mastercard"] },
  { bank: "Axis Bank", variant: "ACE", networks: ["Visa"] },
  { bank: "Axis Bank", variant: "MY ZONE", networks: ["Visa", "Mastercard"] },
  { bank: "Axis Bank", variant: "Airtel", networks: ["Mastercard"] },

  // Kotak Mahindra Bank
  { bank: "Kotak Mahindra Bank", variant: "811 #DreamDifferent", networks: ["RuPay"] },
  { bank: "Kotak Mahindra Bank", variant: "League Platinum", networks: ["Visa", "Mastercard"] },
  { bank: "Kotak Mahindra Bank", variant: "Myntra Kotak", networks: ["Mastercard"] },
  { bank: "Kotak Mahindra Bank", variant: "White Reserve", networks: ["Visa"] },

  // American Express
  { bank: "American Express", variant: "Membership Rewards", networks: ["American Express"] },
  { bank: "American Express", variant: "SmartEarn", networks: ["American Express"] },
  { bank: "American Express", variant: "Platinum Travel", networks: ["American Express"] },
  { bank: "American Express", variant: "Platinum Charge", networks: ["American Express"] },

  // IDFC FIRST Bank
  { bank: "IDFC FIRST Bank", variant: "Millennia", networks: ["Visa", "RuPay"] },
  { bank: "IDFC FIRST Bank", variant: "Select", networks: ["Visa", "Mastercard"] },
  { bank: "IDFC FIRST Bank", variant: "Wealth", networks: ["Visa", "Mastercard"] },
  { bank: "IDFC FIRST Bank", variant: "Power+ (HPCL)", networks: ["RuPay"] },

  // Yes Bank
  { bank: "Yes Bank", variant: "Marquee", networks: ["Visa"] },
  { bank: "Yes Bank", variant: "Paisabazaar PaisaSave", networks: ["RuPay"] },
  { bank: "Yes Bank", variant: "POP-CLUB", networks: ["RuPay"] },

  // RBL Bank
  { bank: "RBL Bank", variant: "ShopRite", networks: ["Visa", "Mastercard"] },
  { bank: "RBL Bank", variant: "World Safari", networks: ["Mastercard"] },
  { bank: "RBL Bank", variant: "IndianOil XTRA", networks: ["RuPay"] },

  // IndusInd Bank
  { bank: "IndusInd Bank", variant: "Legend", networks: ["Visa"] },
  { bank: "IndusInd Bank", variant: "Tiger", networks: ["Mastercard"] },
  { bank: "IndusInd Bank", variant: "EazyDiner Platinum", networks: ["Mastercard"] },

  // Standard Chartered
  { bank: "Standard Chartered", variant: "Smart", networks: ["Visa", "Mastercard"] },
  { bank: "Standard Chartered", variant: "Ultimate", networks: ["Visa", "Mastercard"] },
  { bank: "Standard Chartered", variant: "EaseMyTrip", networks: ["Mastercard"] },

  // HSBC
  { bank: "HSBC", variant: "Cashback", networks: ["Visa", "Mastercard"] },
  { bank: "HSBC", variant: "Live+", networks: ["Visa", "Mastercard"] },
  { bank: "HSBC", variant: "Platinum", networks: ["Visa"] },

  // AU Small Finance Bank
  { bank: "AU Small Finance Bank", variant: "LIT", networks: ["Visa"] },
  { bank: "AU Small Finance Bank", variant: "Altura", networks: ["RuPay", "Visa"] },
  { bank: "AU Small Finance Bank", variant: "Zenith", networks: ["Mastercard"] },
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
