export type InvestorKpiTone = "emerald" | "sky" | "violet" | "amber";

export type InvestorKpi = {
  label: string;
  value: string;
  trend: string;
  tone: InvestorKpiTone;
};

export type DealStrategy = "Wholesale" | "Fix & Flip" | "BRRRR" | "Seller Finance";
export type DealStage = "Prospecting" | "Negotiating" | "Under Contract" | "Disposition";

export type Deal = {
  id: string;
  asset: string;
  market: string;
  strategy: DealStrategy;
  stage: DealStage;
  sellerMotivation: number;
  aiWinProbability: number;
  arv: number;
  purchasePrice: number;
  rehab: number;
  dom: number;
  tags: string[];
};

export type MotivationSignal = "Probate" | "Pre-Foreclosure" | "Tax Delinquent" | "Code Violation" | "Eviction" | "Absentee";

export type MockLead = {
  id: string;
  ownerName: string;
  phone: string;
  propertyAddress: string;
  county: string;
  listPriceEstimate: number;
  equityEstimate: number;
  timelineDays: number;
  distressScore: number;
  motivationSignals: MotivationSignal[];
  channelPreference: "SMS" | "Call" | "Email";
  language: "English" | "Spanish";
  lastInboundHoursAgo: number;
  lastOfferAmount: number;
  occupancy: "Owner Occupied" | "Tenant Occupied" | "Vacant";
};

export type NextBestAction = {
  leadId: string;
  action: string;
  channel: "SMS" | "Call" | "Email";
  urgency: "Critical" | "High" | "Medium";
  reason: string;
};

export const investorKpis: InvestorKpi[] = [
  { label: "Projected Net Revenue (90d)", value: "$2.96M", trend: "+34.1%", tone: "emerald" },
  { label: "Weighted Pipeline", value: "$18.7M", trend: "+$1.8M this week", tone: "sky" },
  { label: "Distress Signals Captured", value: "1,142", trend: "+131 in 24h", tone: "violet" },
  { label: "Avg Days to Close", value: "14.2", trend: "-3.6 days", tone: "amber" },
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

export const mockLeads: MockLead[] = [
  {
    id: "lead-maricopa-001",
    ownerName: "Maria Santos",
    phone: "(602) 555-0182",
    propertyAddress: "3512 W Solano Dr, Phoenix, AZ",
    county: "Maricopa",
    listPriceEstimate: 429000,
    equityEstimate: 214000,
    timelineDays: 10,
    distressScore: 93,
    motivationSignals: ["Probate", "Code Violation", "Absentee"],
    channelPreference: "Call",
    language: "Spanish",
    lastInboundHoursAgo: 2,
    lastOfferAmount: 312000,
    occupancy: "Vacant",
  },
  {
    id: "lead-fulton-017",
    ownerName: "Darryl Greene",
    phone: "(404) 555-0144",
    propertyAddress: "17 Hollow Brook Way, Atlanta, GA",
    county: "Fulton",
    listPriceEstimate: 318000,
    equityEstimate: 121000,
    timelineDays: 14,
    distressScore: 85,
    motivationSignals: ["Pre-Foreclosure", "Eviction"],
    channelPreference: "SMS",
    language: "English",
    lastInboundHoursAgo: 1,
    lastOfferAmount: 228000,
    occupancy: "Tenant Occupied",
  },
  {
    id: "lead-cuyahoga-099",
    ownerName: "Anita Rhodes",
    phone: "(216) 555-0199",
    propertyAddress: "99 E 127th St, Cleveland, OH",
    county: "Cuyahoga",
    listPriceEstimate: 149000,
    equityEstimate: 69000,
    timelineDays: 30,
    distressScore: 76,
    motivationSignals: ["Tax Delinquent", "Absentee"],
    channelPreference: "Email",
    language: "English",
    lastInboundHoursAgo: 18,
    lastOfferAmount: 87000,
    occupancy: "Tenant Occupied",
  },
  {
    id: "lead-bexar-041",
    ownerName: "Jorge Alvarez",
    phone: "(210) 555-0101",
    propertyAddress: "41 Timber Crest, San Antonio, TX",
    county: "Bexar",
    listPriceEstimate: 284000,
    equityEstimate: 173000,
    timelineDays: 7,
    distressScore: 89,
    motivationSignals: ["Code Violation", "Probate"],
    channelPreference: "Call",
    language: "Spanish",
    lastInboundHoursAgo: 0,
    lastOfferAmount: 201000,
    occupancy: "Owner Occupied",
  },
  {
    id: "lead-marion-213",
    ownerName: "Lindsey Rowe",
    phone: "(317) 555-0123",
    propertyAddress: "213 Pine Orchard Dr, Indianapolis, IN",
    county: "Marion",
    listPriceEstimate: 227000,
    equityEstimate: 99000,
    timelineDays: 21,
    distressScore: 68,
    motivationSignals: ["Absentee"],
    channelPreference: "SMS",
    language: "English",
    lastInboundHoursAgo: 36,
    lastOfferAmount: 151000,
    occupancy: "Tenant Occupied",
  },
  {
    id: "lead-harris-055",
    ownerName: "Patrick O'Neil",
    phone: "(713) 555-0155",
    propertyAddress: "55 Scenic Bend, Houston, TX",
    county: "Harris",
    listPriceEstimate: 504000,
    equityEstimate: 238000,
    timelineDays: 5,
    distressScore: 96,
    motivationSignals: ["Pre-Foreclosure", "Code Violation", "Tax Delinquent"],
    channelPreference: "Call",
    language: "English",
    lastInboundHoursAgo: 3,
    lastOfferAmount: 338000,
    occupancy: "Vacant",
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
  "🔥 42 new high-equity distress leads landed in your buy boxes across 5 markets.",
  "⚡ Seller replied: 'Need to move this week' — AI recommends call in next 8 minutes.",
  "🏁 Cash buyer 'Ridgeway Holdings' opened dispo package 6x in 90 minutes.",
  "📈 Phoenix flip model suggests +$38k upside by reducing scope to cosmetic-only rehab.",
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function estimateDealSpread(deal: Deal) {
  return deal.arv - deal.purchasePrice - deal.rehab;
}

export function calculateLeadHeat(lead: MockLead) {
  const urgency = Math.max(0, 100 - lead.timelineDays * 2);
  const recencyBoost = Math.max(0, 30 - lead.lastInboundHoursAgo);
  const signalBoost = lead.motivationSignals.length * 7;
  return Math.min(100, Math.round(lead.distressScore * 0.5 + urgency * 0.3 + recencyBoost * 0.1 + signalBoost));
}

export function predictConversionProbability(lead: MockLead) {
  const heat = calculateLeadHeat(lead);
  const offerStrength = Math.min(100, Math.round((lead.lastOfferAmount / lead.listPriceEstimate) * 100));
  const score = Math.round(heat * 0.55 + offerStrength * 0.35 + (lead.language === "Spanish" ? 6 : 0));
  return Math.min(97, Math.max(8, score));
}

export function getNextBestAction(lead: MockLead): NextBestAction {
  const conversion = predictConversionProbability(lead);
  if (lead.timelineDays <= 7 || conversion >= 90) {
    return {
      leadId: lead.id,
      action: "Launch same-hour acquisition call + send proof-of-funds follow-up.",
      channel: "Call",
      urgency: "Critical",
      reason: "High close probability with urgent seller timeline.",
    };
  }

  if (lead.channelPreference === "SMS") {
    return {
      leadId: lead.id,
      action: "Send AI-personalized 3-touch SMS sequence and booking link.",
      channel: "SMS",
      urgency: "High",
      reason: "Owner prefers text and has active distress markers.",
    };
  }

  return {
    leadId: lead.id,
    action: "Deliver seller-specific offer recap with comps and timeline options.",
    channel: "Email",
    urgency: "Medium",
    reason: "Nurture path with data-rich value framing.",
  };
}

export function buildLeadCommandQueue(leads: MockLead[]) {
  return [...leads]
    .map((lead) => ({
      lead,
      heat: calculateLeadHeat(lead),
      conversion: predictConversionProbability(lead),
      nextAction: getNextBestAction(lead),
    }))
    .sort((a, b) => b.heat - a.heat || b.conversion - a.conversion);
}

export function simulateCampaignOutcome(leads: MockLead[]) {
  const queue = buildLeadCommandQueue(leads);
  const expectedAppointments = Math.round(queue.reduce((acc, item) => acc + item.conversion * 0.08, 0));
  const expectedContracts = Math.round(queue.reduce((acc, item) => acc + item.conversion * 0.035, 0));
  const projectedRevenue = queue.reduce((acc, item) => acc + item.lead.equityEstimate * (item.conversion / 100) * 0.17, 0);

  return {
    expectedAppointments,
    expectedContracts,
    projectedRevenue,
  };
}
