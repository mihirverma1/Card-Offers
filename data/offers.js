// ---------------------------------------------------------------------------
// OFFERS DATABASE ("the spreadsheet")
//
// Each entry is one structured, verified offer. The app reads from this file
// and shows offers for the exact card a user selects. The refresh pipeline
// (scripts/ingest.mjs) regenerates this file by crawling bank/network/merchant
// pages with Firecrawl and structuring the results with an AI.
//
// These seeded entries are well-known, long-running offers included so the app
// works today. They each carry a `sourceUrl` and `lastUpdated`; always treat
// the bank's linked page as the final word on current terms.
//
// Matching rules used by the API:
//   - bank must equal the selected bank
//   - `cards` must include the selected variant, OR be ["all"]
//   - `networks` must include the selected network, OR be ["all"]
// ---------------------------------------------------------------------------

export const OFFERS = [
  {
    id: "icici-amazonpay-amazon",
    bank: "ICICI Bank",
    cards: ["Amazon Pay"],
    networks: ["Visa"],
    category: "Shopping",
    merchant: "Amazon",
    title: "5% back on Amazon for Prime members",
    discount: "Up to 5% cashback",
    description:
      "Earn unlimited cashback as Amazon Pay balance on Amazon.in shopping, plus rewards on bill payments and partner merchants.",
    minSpend: "No minimum",
    maxDiscount: "No cap",
    rewardBreakup: [
      "5% back on Amazon.in for Prime members",
      "3% back on Amazon.in for non-Prime members",
      "2% back on 100+ Amazon Pay partner merchants",
      "1% back on all other spends",
    ],
    eligibility: "Any holder of the Amazon Pay ICICI Bank Credit Card.",
    howToAvail:
      "Pay with the Amazon Pay ICICI card. Cashback is auto-credited as Amazon Pay balance, usually within a few days.",
    terms: [
      "Cashback is credited as Amazon Pay balance, not statement credit.",
      "Excluded categories (e.g. gold, some gift cards, EMI) may not earn the higher rate.",
      "Prime rate applies only while your Prime membership is active.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "sbi-cashback-online",
    bank: "SBI Card",
    cards: ["Cashback", "Cashback (RuPay UPI)"],
    networks: ["Visa", "RuPay"],
    category: "Shopping",
    merchant: "All online merchants",
    title: "5% cashback on all online spends",
    discount: "5% cashback online",
    description:
      "Flat 5% cashback on online shopping across most merchants with no merchant restriction, and 1% on offline spends.",
    minSpend: "No minimum",
    maxDiscount: "₹5,000 cashback per statement cycle",
    rewardBreakup: [
      "5% cashback on online spends (most merchants)",
      "1% cashback on offline/in-store spends",
    ],
    eligibility: "SBI Cashback Card holders.",
    howToAvail:
      "Shop online with the card. Cashback is auto-credited to your statement within 2 working days of the next billing cycle.",
    terms: [
      "Total cashback capped at ₹5,000 per statement cycle.",
      "Rent, wallet loads, fuel, utilities and some categories are excluded from the 5%.",
      "Annual fee waiver on spends of ₹2,00,000 in a year.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.sbicard.com/en/personal/credit-cards/shopping/sbi-card-cashback.page",
    lastUpdated: "2026-06-28",
  },
  {
    id: "hdfc-millennia-cashback",
    bank: "HDFC Bank",
    cards: ["Millennia"],
    networks: ["Visa", "Mastercard"],
    category: "Shopping",
    merchant: "Amazon, Flipkart, Swiggy, Zomato & more",
    title: "5% cashback on top online brands",
    discount: "5% cashback (as CashPoints)",
    description:
      "5% cashback as CashPoints on popular merchants like Amazon, Flipkart, Swiggy, Zomato, Myntra, Uber and more; 1% on other spends.",
    minSpend: "No minimum",
    maxDiscount: "₹1,000 CashPoints per calendar month",
    rewardBreakup: [
      "5% on Amazon, Flipkart, Swiggy, Zomato, Myntra, Uber, Cult.fit, Tata CLiQ, BookMyShow, Sony LIV",
      "1% on all other spends",
    ],
    eligibility: "HDFC Millennia Credit Card holders.",
    howToAvail:
      "Pay with the Millennia card at the listed merchants. CashPoints are credited and can be redeemed against the statement.",
    terms: [
      "Maximum 5% CashPoints capped at ₹1,000 per month.",
      "Additional ₹1,000/month cap for other (1%) spends combined.",
      "1 CashPoint = ₹1 when redeemed against statement balance.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-cards/millennia-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "hdfc-swiggy-dining",
    bank: "HDFC Bank",
    cards: ["Swiggy"],
    networks: ["Mastercard"],
    category: "Dining",
    merchant: "Swiggy",
    title: "10% cashback on Swiggy",
    discount: "10% cashback",
    description:
      "10% cashback on Swiggy app spends (Food, Instamart, Dineout, Genie) and 5% on other online spends.",
    minSpend: "No minimum",
    maxDiscount: "₹1,500 cashback per month combined",
    rewardBreakup: [
      "10% cashback on Swiggy (Food, Instamart, Dineout, Genie)",
      "5% cashback on other online spends",
      "1% on all other categories",
    ],
    eligibility: "Swiggy HDFC Bank Credit Card holders with an active Swiggy account.",
    howToAvail: "Pay using the Swiggy HDFC card on the Swiggy app. Cashback reflects as Swiggy Money.",
    terms: [
      "10% + 5% cashback capped at ₹1,500 per calendar month combined.",
      "Cashback credited as Swiggy Money in the Swiggy app.",
      "Complimentary Swiggy One membership on card activation (3 months).",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-bank-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "hdfc-tataneu-infinity",
    bank: "HDFC Bank",
    cards: ["Tata Neu Infinity"],
    networks: ["RuPay", "Visa"],
    category: "Shopping",
    merchant: "Tata Neu & brands",
    title: "Up to 10% back in NeuCoins on Tata brands",
    discount: "Up to 10% NeuCoins",
    description:
      "Earn NeuCoins on Tata Neu and partner Tata brands (BigBasket, Croma, 1mg, Westside, Air India), plus extra on RuPay UPI spends.",
    minSpend: "No minimum",
    maxDiscount: "Caps apply per category",
    rewardBreakup: [
      "5% NeuCoins on Tata Neu & partner Tata brand spends (with NeuPass)",
      "1.5% NeuCoins on other merchant spends",
      "Additional 1% NeuCoins on UPI spends (RuPay variant)",
    ],
    eligibility: "Tata Neu Infinity HDFC Bank Credit Card holders.",
    howToAvail: "Pay via card or linked RuPay UPI. NeuCoins reflect in the Tata Neu app.",
    terms: [
      "1 NeuCoin = ₹1 on Tata Neu.",
      "NeuPass must be active to earn the higher 5% rate.",
      "Monthly caps apply on bonus NeuCoins per category.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity-hdfc-bank-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "axis-flipkart-shopping",
    bank: "Axis Bank",
    cards: ["Flipkart"],
    networks: ["Mastercard"],
    category: "Shopping",
    merchant: "Flipkart, Myntra, Cleartrip",
    title: "5% cashback on Flipkart & Myntra",
    discount: "Up to 5% cashback",
    description:
      "Unlimited 5% cashback on Flipkart and Cleartrip, 4% on preferred merchants like Swiggy, PVR, Uber, and 1% on everything else.",
    minSpend: "No minimum",
    maxDiscount: "No cap on Flipkart/Myntra cashback",
    rewardBreakup: [
      "5% cashback on Flipkart, Myntra, Cleartrip",
      "4% on preferred partners (Swiggy, PVR, Uber, Cult.fit, Tata Play)",
      "1% on all other spends",
    ],
    eligibility: "Flipkart Axis Bank Credit Card holders.",
    howToAvail: "Pay with the Flipkart Axis card. Cashback is auto-adjusted to the statement.",
    terms: [
      "Cashback excludes gold, wallet, rent, fuel, EMI and a few categories.",
      "Cashback credited within 12 working days of the transaction.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.axisbank.com/retail/cards/credit-card/flipkart-axis-bank-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "axis-ace-bills",
    bank: "Axis Bank",
    cards: ["ACE"],
    networks: ["Visa"],
    category: "Utilities",
    merchant: "Google Pay bills, Swiggy, Zomato, Ola",
    title: "5% cashback on bill payments via Google Pay",
    discount: "Up to 5% cashback",
    description:
      "5% cashback on utility bills and recharges via Google Pay, 4% on Swiggy/Zomato/Ola, and 2% unlimited on all other spends.",
    minSpend: "No minimum",
    maxDiscount: "₹500/month on 5% and 4% categories",
    rewardBreakup: [
      "5% on electricity, gas, mobile/DTH bills & recharges via Google Pay",
      "4% on Swiggy, Zomato, Ola",
      "2% on all other spends",
    ],
    eligibility: "Axis Bank ACE Credit Card holders.",
    howToAvail: "Pay bills through Google Pay using the ACE card; other spends earn 2% automatically.",
    terms: [
      "5% + 4% category cashback capped at ₹500 per month combined.",
      "2% category has no upper limit.",
      "Rent, wallet, fuel, EMI excluded.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.axisbank.com/retail/cards/credit-card/ace-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "axis-atlas-travel",
    bank: "Axis Bank",
    cards: ["Atlas"],
    networks: ["Visa"],
    category: "Travel",
    merchant: "Travel bookings & airline/hotel partners",
    title: "Up to 5 EDGE Miles per ₹100 on travel",
    discount: "5X EDGE Miles on travel",
    description:
      "Earn 5 EDGE Miles per ₹100 on travel (airlines/hotels via Travel EDGE), 2 per ₹100 elsewhere, plus milestone bonuses and lounge access.",
    minSpend: "No minimum",
    maxDiscount: "Monthly cap on accelerated miles",
    rewardBreakup: [
      "5 EDGE Miles / ₹100 on travel EDGE bookings",
      "2 EDGE Miles / ₹100 on other spends",
      "Milestone bonus miles on annual spends",
    ],
    eligibility: "Axis Bank Atlas Credit Card holders.",
    howToAvail: "Book travel via the Travel EDGE portal and pay with the Atlas card to earn accelerated miles.",
    terms: [
      "Accelerated 5X miles capped per calendar month.",
      "EDGE Miles transfer to airline/hotel partners.",
      "Domestic and international lounge access tiered by annual spend.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.axisbank.com/retail/cards/credit-card/axis-bank-atlas-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "sbi-simplyclick-online",
    bank: "SBI Card",
    cards: ["SimplyCLICK"],
    networks: ["Visa", "Mastercard"],
    category: "Shopping",
    merchant: "Amazon, BookMyShow, Cleartrip & online partners",
    title: "10X reward points on online partners",
    discount: "10X reward points",
    description:
      "10X reward points on online spends with exclusive partners (Amazon, BookMyShow, Cleartrip, Apollo 24|7, Netmeds), 5X on other online spends.",
    minSpend: "No minimum",
    maxDiscount: "Caps on bonus points apply",
    rewardBreakup: [
      "10X points on partner brands (Amazon, BookMyShow, Cleartrip, etc.)",
      "5X points on all other online spends",
      "1 point per ₹100 on offline spends",
    ],
    eligibility: "SBI SimplyCLICK Card holders.",
    howToAvail: "Shop online with partners and pay with the card; points credit to your SBI Card account.",
    terms: [
      "4 reward points = ₹1 on redemption.",
      "₹2,000 Amazon gift voucher on joining (on fee payment).",
      "Annual fee waiver on ₹1,00,000 yearly spend.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.sbicard.com/en/personal/credit-cards/shopping/simplyclick-sbi-card.page",
    lastUpdated: "2026-06-28",
  },
  {
    id: "icici-coral-dining-movies",
    bank: "ICICI Bank",
    cards: ["Coral"],
    networks: ["Visa", "Mastercard", "RuPay"],
    category: "Dining",
    merchant: "Restaurants & BookMyShow",
    title: "Up to 15% dining discount + movie ticket offer",
    discount: "Up to 15% off dining",
    description:
      "Up to 15% savings at 2,500+ partner restaurants via ICICI Culinary Treats, plus discount on movie tickets via BookMyShow.",
    minSpend: "Varies by partner restaurant",
    maxDiscount: "Per-partner caps apply",
    rewardBreakup: [
      "Up to 15% off at partner restaurants (Culinary Treats)",
      "₹100 off on 2 movie tickets/month on BookMyShow",
      "2 reward points per ₹100 spent",
    ],
    eligibility: "ICICI Bank Coral Credit Card holders.",
    howToAvail: "Use the card at partner restaurants / on BookMyShow; discount applied at checkout or billing.",
    terms: [
      "Dining discount available only at listed partner outlets.",
      "Movie offer limited to 2 tickets per month.",
      "Minimum 4 transactions/month may be needed for some benefits.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.icicibank.com/personal-banking/cards/credit-card/coral-credit-card",
    lastUpdated: "2026-06-28",
  },
  {
    id: "kotak-811-upi",
    bank: "Kotak Mahindra Bank",
    cards: ["811 #DreamDifferent"],
    networks: ["RuPay"],
    category: "UPI",
    merchant: "UPI / scan & pay",
    title: "Reward points on RuPay UPI spends",
    discount: "Reward points on UPI",
    description:
      "Earn reward points on everyday UPI (scan-and-pay) and online spends with the RuPay credit card linked to UPI.",
    minSpend: "No minimum",
    maxDiscount: "Monthly points cap applies",
    rewardBreakup: [
      "Reward points on UPI spends via linked RuPay credit card",
      "Points on online and retail spends",
    ],
    eligibility: "Kotak 811 #DreamDifferent RuPay Credit Card holders with the card linked to a UPI app.",
    howToAvail: "Link the RuPay card to a UPI app (e.g. GPay/PhonePe) and scan-and-pay.",
    terms: [
      "UPI reward points subject to monthly caps.",
      "Some categories (rent, fuel, wallet) are excluded.",
      "Points expire as per the rewards programme.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    lastUpdated: "2026-06-28",
  },
  {
    id: "idfc-millennia-movies",
    bank: "IDFC FIRST Bank",
    cards: ["Millennia"],
    networks: ["Visa", "RuPay"],
    category: "Movies",
    merchant: "Movie tickets & online",
    title: "Buy-one-get-one on movie tickets",
    discount: "BOGO movie tickets",
    description:
      "Buy-one-get-one free on movie tickets (monthly), accelerated reward points on online spends, and rewards on UPI.",
    minSpend: "As per movie offer terms",
    maxDiscount: "₹250 off on the free ticket",
    rewardBreakup: [
      "Buy 1 Get 1 free movie ticket, once per month (up to ₹250)",
      "Up to 10X reward points on higher-value spends",
      "Reward points on UPI spends (RuPay variant)",
    ],
    eligibility: "IDFC FIRST Millennia Credit Card holders.",
    howToAvail: "Book via the partner platform (e.g. District/Paytm as applicable) and pay with the card.",
    terms: [
      "Movie offer limited to once per calendar month.",
      "10X points apply above a monthly spend threshold on select categories.",
      "Reward points never expire (as per IDFC programme).",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.idfcfirstbank.com/credit-card/millennia",
    lastUpdated: "2026-06-28",
  },
  {
    id: "hdfc-diners-black-smartbuy",
    bank: "HDFC Bank",
    cards: ["Diners Club Black"],
    networks: ["Diners Club"],
    category: "Travel",
    merchant: "SmartBuy & airport lounges",
    title: "10X reward points on SmartBuy + unlimited lounge access",
    discount: "10X reward points",
    description:
      "Up to 10X reward points on flights, hotels and shopping via HDFC SmartBuy, complimentary airport lounge access, and premium memberships.",
    minSpend: "No minimum",
    maxDiscount: "Monthly cap on bonus points",
    rewardBreakup: [
      "10X reward points on SmartBuy bookings",
      "5 reward points per ₹150 on other spends",
      "Unlimited domestic & international lounge access (primary + add-on)",
    ],
    eligibility: "HDFC Diners Club Black Credit Card holders.",
    howToAvail: "Book through HDFC SmartBuy and pay with the card to earn accelerated points.",
    terms: [
      "10X bonus points capped per calendar month.",
      "Complimentary memberships (e.g. Swiggy One, Times Prime) subject to terms.",
      "Annual fee waiver on ₹8,00,000 yearly spend.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-club-black",
    lastUpdated: "2026-06-28",
  },
  {
    id: "amex-mrcc-milestone",
    bank: "American Express",
    cards: ["Membership Rewards"],
    networks: ["American Express"],
    category: "Shopping",
    merchant: "All spends + milestone vouchers",
    title: "Milestone bonus points & welcome vouchers",
    discount: "Bonus Membership Rewards points",
    description:
      "Earn Membership Rewards points on spends with milestone bonuses, plus welcome and monthly spend-based vouchers.",
    minSpend: "Milestone thresholds apply",
    maxDiscount: "As per milestone tiers",
    rewardBreakup: [
      "1 point per ₹50 spent (most categories)",
      "Bonus points on hitting monthly spend milestones",
      "Welcome bonus vouchers on meeting initial spend",
    ],
    eligibility: "Amex Membership Rewards Card holders.",
    howToAvail: "Spend to hit the listed milestones; bonus points/vouchers are credited automatically.",
    terms: [
      "Milestone benefits require minimum monthly spends (e.g. 2 transactions of ₹1,500+).",
      "Some categories (utilities, insurance, fuel) earn reduced or no points.",
      "Points have no expiry while the account is active.",
    ],
    validFrom: "Ongoing",
    validTill: "Ongoing",
    sourceUrl: "https://www.americanexpress.com/in/credit-cards/membership-rewards-credit-card/",
    lastUpdated: "2026-06-28",
  },
];

// Filter offers for a selected card. `category` is optional.
export function filterOffers({ bank, variant, network, category } = {}) {
  return OFFERS.filter((offer) => {
    if (bank && offer.bank !== bank) return false;
    if (variant && !(offer.cards.includes("all") || offer.cards.includes(variant))) return false;
    if (network && !(offer.networks.includes("all") || offer.networks.includes(network))) return false;
    if (category && offer.category !== category) return false;
    return true;
  });
}
