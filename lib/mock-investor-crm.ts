export type InvestorKpi = {
  label: string;
  value: string;
  trend: string;
  tone: "emerald" | "sky" | "violet" | "amber";
};

export type Deal = {
  id: string;
  asset: string;
  market: string;
  strategy: "Wholesale" | "Fix & Flip" | "BRRRR" | "Seller Finance";
  stage: "Prospecting" | "Negotiating" | "Under Contract" | "Disposition";
  sellerMotivation: number;
  aiWinProbability: number;
  arv: number;
  purchasePrice: number;
  rehab: number;
  dom: number;
  tags: string[];
};

export const investorKpis: InvestorKpi[] = [
  { label: "Projected Net Revenue (90d)", value: "$1.84M", trend: "+18.4%", tone: "emerald" },
  { label: "Weighted Pipeline", value: "$12.2M", trend: "+$940k this week", tone: "sky" },
  { label: "Distress Signals Captured", value: "287", trend: "+54 in 24h", tone: "violet" },
  { label: "Avg Days to Close", value: "17.8", trend: "-2.3 days", tone: "amber" },
];

export const acquisitionsQueue: Deal[] = [
  {
    id: "deal-phx-112",
    asset: "112 E Desert Palm Dr",
    market: "Phoenix, AZ",
    strategy: "Fix & Flip",
    stage: "Negotiating",
    sellerMotivation: 91,
    aiWinProbability: 78,
    arv: 540000,
    purchasePrice: 338000,
    rehab: 62000,
    dom: 12,
    tags: ["Probate", "Vacant", "Code Violation"],
  },
  {
    id: "deal-atl-57",
    asset: "57 Maple Creek Ct",
    market: "Atlanta, GA",
    strategy: "Wholesale",
    stage: "Under Contract",
    sellerMotivation: 86,
    aiWinProbability: 88,
    arv: 312000,
    purchasePrice: 208000,
    rehab: 18000,
    dom: 7,
    tags: ["Pre-Foreclosure", "Absentee Owner"],
  },
  {
    id: "deal-cle-409",
    asset: "409 E 141st St",
    market: "Cleveland, OH",
    strategy: "BRRRR",
    stage: "Prospecting",
    sellerMotivation: 74,
    aiWinProbability: 56,
    arv: 164000,
    purchasePrice: 76000,
    rehab: 42000,
    dom: 19,
    tags: ["Tax Delinquent", "Inherited"],
  },
  {
    id: "deal-dfw-28",
    asset: "28 Copper Ridge Ln",
    market: "Dallas-Fort Worth, TX",
    strategy: "Seller Finance",
    stage: "Disposition",
    sellerMotivation: 81,
    aiWinProbability: 69,
    arv: 468000,
    purchasePrice: 349000,
    rehab: 21000,
    dom: 26,
    tags: ["High Equity", "Tired Landlord"],
  },
];

export const aiPlaybooks = [
  {
    title: "Pre-Foreclosure Rapid Sequence",
    impact: "+23% response lift",
    channelMix: "SMS + Ringless VM + AI Voice",
    steps: ["Trigger skip trace", "Score hardship language", "Send urgency sequence in 11 min"],
  },
  {
    title: "Landlord Fatigue Detection",
    impact: "11.2% more appointments",
    channelMix: "Direct mail + Smart retargeting",
    steps: ["Detect rent complaints", "Launch equity-focused offer", "Book call via AI ISA"],
  },
  {
    title: "Cash Buyer Smart Blast",
    impact: "Avg dispo in 4.7 days",
    channelMix: "Buyer clusters + WhatsApp + Email",
    steps: ["Cluster by ZIP + strategy", "Rank by close velocity", "Auto-send comps + photos"],
  },
];

export const marketRadar = [
  { metro: "Phoenix", score: 94, signal: "Investor demand spike", spread: "+11.6%" },
  { metro: "Cleveland", score: 88, signal: "Rental yield acceleration", spread: "+8.1%" },
  { metro: "San Antonio", score: 82, signal: "Distress inventory growth", spread: "+7.4%" },
  { metro: "Indianapolis", score: 79, signal: "Auction discount widening", spread: "+6.9%" },
];

export const commandCenterAlerts = [
  "🔥 14 new probate leads matched your buy box in Maricopa County.",
  "⚡ One seller replied 'need to move this week' — recommended call window in 9 minutes.",
  "🏁 Cash buyer 'Ridgeway Holdings' opened dispo package 3 times in 2 hours.",
  "📈 Your Phoenix flip model suggests +$31k profit upside with cosmetic scope reduction.",
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
