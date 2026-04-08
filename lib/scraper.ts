import type { InvestorLeadCategory, InvestorLeadProfile, Lead, LeadEnrichmentPayload, LeadResearchSocialLinks, LeadResearchStructuredPayload } from "@/lib/types";

type GooglePlaceSearchResponse = {
  status?: string;
  results?: Array<{ place_id?: string }>;
  next_page_token?: string;
};

type GooglePlaceDetailsResponse = {
  status?: string;
  result?: {
    name?: string;
    formatted_address?: string;
    website?: string;
    formatted_phone_number?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: Array<{ time?: number }>;
  };
};

const SCRAPE_FETCH_TIMEOUT_MS = 15000;
const SCRAPE_RETRY_ATTEMPTS = 3;
const MAX_AI_MICRO_QUERIES = 10;
const MAX_RESULTS_PAGES_PER_QUERY = 2;
const MAX_PLACE_DETAILS_LOOKUPS_PER_RUN = 80;
const MAX_LEADS_PER_RUN = 40;
const SCRAPE_RUNTIME_BUDGET_MS = 45000;

type ScrapeMode = "DISTRESSED_SELLERS" | "CASH_BUYERS" | "REALTORS" | "WHOLESALERS" | "PROPERTY_MANAGERS" | "CONTRACTORS";

type ScrapeOptions = {
  city: string;
  businessType: string;
  minRating?: number;
  includeNoWebsiteOnly?: boolean;
  investorCategory?: ScrapeMode;
  targetPropertyType?: string;
};

const INVESTOR_SCRAPE_PRESETS: Record<
  ScrapeMode,
  {
    leadCategory: InvestorLeadCategory;
    fallbackTerms: string[];
    defaultAction: string;
  }
> = {
  DISTRESSED_SELLERS: {
    leadCategory: "DISTRESSED_SELLER",
    fallbackTerms: ["probate attorney", "eviction attorney", "bankruptcy attorney", "estate sale company", "property manager"],
    defaultAction: "Build a referral relationship and ask about owners dealing with distress, probate, vacancy, or fast-sale situations.",
  },
  CASH_BUYERS: {
    leadCategory: "CASH_BUYER",
    fallbackTerms: ["cash home buyer", "we buy houses", "house buying company", "investment property buyer"],
    defaultAction: "Qualify this contact as an active buyer and capture buy box, markets, and proof-of-funds expectations.",
  },
  REALTORS: {
    leadCategory: "AGENT",
    fallbackTerms: ["realtor", "real estate agent", "listing agent", "real estate broker"],
    defaultAction: "Pitch investor-friendly referrals, off-market collaboration, and fast-close options for difficult listings.",
  },
  WHOLESALERS: {
    leadCategory: "WHOLESALER",
    fallbackTerms: ["real estate wholesaler", "off market property buyer", "assignment contract buyer", "investment home buyer"],
    defaultAction: "Qualify deal flow, assignment expectations, and the type of inventory they can send or buy.",
  },
  PROPERTY_MANAGERS: {
    leadCategory: "PROPERTY_MANAGER",
    fallbackTerms: ["property manager", "rental property management", "apartment management company", "leasing company"],
    defaultAction: "Ask about tired landlords, vacancy issues, and owners who may prefer a direct sale over another turn.",
  },
  CONTRACTORS: {
    leadCategory: "CONTRACTOR",
    fallbackTerms: ["general contractor", "roofer", "foundation repair", "junk removal", "fire damage restoration"],
    defaultAction: "Use the relationship to surface distressed properties, rehab needs, and owners needing a fast exit.",
  },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanPhoneNumber(phoneStr?: string | null) {
  if (!phoneStr) return "";
  return phoneStr.replace(/\D/g, "");
}

function buildSearchQueries(city: string, businessType: string, investorCategory: ScrapeMode, targetPropertyType?: string) {
  const cleanCity = city.trim();
  const cleanBusinessType = businessType.trim();
  const cleanPropertyType = targetPropertyType?.trim() || "";
  const preset = INVESTOR_SCRAPE_PRESETS[investorCategory];
  const coreTerms = Array.from(new Set([cleanBusinessType, ...preset.fallbackTerms].map((term) => term.trim()).filter(Boolean)));
  const propertySuffix = cleanPropertyType ? ` ${cleanPropertyType}` : "";

  const baseQueries = coreTerms.flatMap((term) => [
    `${term} ${cleanCity}`,
    `${term} in ${cleanCity}`,
    `${term}${propertySuffix} ${cleanCity}`.trim(),
    `${term} near ${cleanCity}`,
    `${term} motivated seller ${cleanCity}`,
    `${term} real estate investor ${cleanCity}`,
  ]);

  return Array.from(new Set(baseQueries.map((query) => query.trim()).filter(Boolean))).slice(0, 24);
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = SCRAPE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiText(prompt: string, geminiApiKey?: string): Promise<string> {
  if (!geminiApiKey) return "";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return "";
    const json = await response.json() as any;
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function generateMicroQueries(userPrompt: string, investorCategory: ScrapeMode, city: string, businessType: string, targetPropertyType?: string, geminiApiKey?: string) {
  const fallback = buildSearchQueries(city, businessType, investorCategory, targetPropertyType);
  if (!geminiApiKey) return fallback;

  const prompt = `You are helping a real estate investor build Google Maps search queries for lead sources and partner channels.
Generate 40 to 60 highly specific Google Maps queries for: "${userPrompt}".
Priority: motivated seller referral sources, investor-friendly professionals, buyer/disposition partners, and operators adjacent to distressed property situations.
Include neighborhoods, suburbs, city variants, and relevant commercial wording.
Return ONLY a comma-separated list. No bullets, no markdown, no explanation.`;

  const raw = await callGeminiText(prompt, geminiApiKey);
  const aiQueries = raw
    .split(",")
    .map((q: string) => q.trim())
    .filter(Boolean);

  const merged = Array.from(new Set([...fallback, ...aiQueries]));
  return merged.slice(0, MAX_AI_MICRO_QUERIES);
}

function inferMotivationSignals(query: string, businessType: string, category: InvestorLeadCategory) {
  const text = `${query} ${businessType}`.toLowerCase();
  const signals = new Set<string>();

  if (text.includes("probate")) signals.add("probate");
  if (text.includes("eviction")) signals.add("eviction");
  if (text.includes("bankruptcy")) signals.add("bankruptcy");
  if (text.includes("estate")) signals.add("estate transition");
  if (text.includes("property manager")) signals.add("tired landlord access");
  if (text.includes("cash buyer") || text.includes("we buy houses")) signals.add("active buyer");
  if (text.includes("wholesaler")) signals.add("off-market inventory");
  if (text.includes("realtor") || text.includes("broker")) signals.add("listing access");
  if (text.includes("contractor") || text.includes("repair") || text.includes("restoration")) signals.add("distress visibility");
  if (category === "DISTRESSED_SELLER" && signals.size === 0) signals.add("motivated seller adjacency");

  return Array.from(signals);
}

function buildInvestorLeadProfile(input: {
  investorCategory: ScrapeMode;
  targetPropertyType?: string;
  query: string;
  businessType: string;
  hasRealWebsite: boolean;
  rating: number;
  reviewCount: number;
  name: string;
  city: string;
}): InvestorLeadProfile {
  const preset = INVESTOR_SCRAPE_PRESETS[input.investorCategory];
  const motivationSignals = inferMotivationSignals(input.query, input.businessType, preset.leadCategory);
  let score = 50;
  if (!input.hasRealWebsite) score += 12;
  if (input.rating >= 4.2) score += 8;
  if (input.reviewCount >= 15) score += 6;
  if (motivationSignals.includes("probate") || motivationSignals.includes("eviction") || motivationSignals.includes("bankruptcy")) score += 14;
  if (preset.leadCategory === "CASH_BUYER" || preset.leadCategory === "WHOLESALER") score += 8;
  score = Math.max(25, Math.min(100, score));

  const tags = [
    preset.leadCategory.replaceAll("_", " "),
    input.targetPropertyType ? `${input.targetPropertyType} focus` : null,
    !input.hasRealWebsite ? "No direct website" : "Has website",
    input.rating > 0 ? `${input.rating.toFixed(1)} Google rating` : null,
  ].filter(Boolean) as string[];

  return {
    category: preset.leadCategory,
    targetPropertyType: input.targetPropertyType || null,
    propertyAddress: null,
    ownerName: null,
    leadType: input.businessType,
    leadScore: score,
    tags,
    motivationSignals,
    recommendedAction: preset.defaultAction,
    rationale: `${input.name} surfaced from "${input.query}" in ${input.city}. ${!input.hasRealWebsite ? "No direct website increases outreach opportunity." : "Established local presence may support partnership credibility."}`,
    sourceKind: "GOOGLE_MAPS",
  };
}

async function fetchSearchPage(params: URLSearchParams) {
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;

  for (let attempt = 1; attempt <= SCRAPE_RETRY_ATTEMPTS; attempt += 1) {
    const searchJson = await fetchJsonWithTimeout<GooglePlaceSearchResponse>(searchUrl);
    if (!searchJson) {
      if (attempt < SCRAPE_RETRY_ATTEMPTS) {
        await sleep(1200 * attempt);
        continue;
      }
      return null;
    }

    const status = searchJson.status ?? "";
    if (status === "DEADLINE_EXCEEDED") {
      if (attempt < SCRAPE_RETRY_ATTEMPTS) {
        await sleep(1800 * attempt);
        continue;
      }
      return null;
    }

    return searchJson;
  }

  return null;
}


function parseJsonFromModelResponse(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toStringOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toStringRecord(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, string>;

  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val !== "string") continue;
    const normalized = val.trim();
    if (!normalized) continue;
    out[key] = normalized;
  }

  return out;
}

function normalizeResearchResult(input: { name: string; phone?: string | null }, raw: Record<string, unknown> | null): LeadEnrichmentPayload {
  const structuredRaw = raw?.structured && typeof raw.structured === "object" ? (raw.structured as Record<string, unknown>) : raw;

  const confidenceValue =
    typeof structuredRaw?.confidence === "number"
      ? structuredRaw.confidence
      : typeof raw?.confidence === "number"
        ? raw.confidence
        : 0.25;

  const confidence = Math.min(1, Math.max(0, confidenceValue));

  const structured: LeadResearchStructuredPayload = {
    businessName: toStringOrNull(structuredRaw?.businessName) ?? input.name,
    primaryPhone: toStringOrNull(structuredRaw?.primaryPhone) ?? toStringOrNull(input.phone ?? null),
    primaryEmail: toStringOrNull(structuredRaw?.primaryEmail),
    logoUrl: toStringOrNull(structuredRaw?.logoUrl),
    brandColors: toStringArray(structuredRaw?.brandColors),
    socialLinks: toStringRecord(structuredRaw?.socialLinks),
    heroCopy: toStringOrNull(structuredRaw?.heroCopy),
    services: toStringArray(structuredRaw?.services),
    trustSignals: toStringArray(structuredRaw?.trustSignals),
    confidence,
    sources: toStringArray(structuredRaw?.sources),
  };

  const summary =
    toStringOrNull(raw?.summary) ??
    toStringOrNull((raw as Record<string, unknown> | null)?.humanSummary) ??
    toStringOrNull((raw as Record<string, unknown> | null)?.aiResearchSummary) ??
    "Limited online footprint found.";

  return { summary, structured };
}

async function researchLeadWithGemini(name: string, phone: string, address: string, geminiApiKey?: string): Promise<LeadEnrichmentPayload> {
  const fallback = normalizeResearchResult({ name, phone }, {
    summary: "Limited online footprint found.",
    businessName: name,
    primaryPhone: phone,
    confidence: 0.2,
    sources: [],
  });

  if (!geminiApiKey) return fallback;

  const prompt = `You are an expert real estate investor lead researcher.
Research this company or contact and return ONLY strict JSON with this shape:
{
  "summary": "2-3 sentence, human-readable investor summary focused on why this lead matters for acquisitions, referrals, buyers, or dispo.",
  "structured": {
    "businessName": "string",
    "primaryPhone": "string|null",
    "primaryEmail": "string|null",
    "logoUrl": "string|null",
    "brandColors": ["string"],
    "socialLinks": {
      "facebook": "string",
      "instagram": "string",
      "googleBusiness": "string",
      "linkedin": "string",
      "x": "string",
      "youtube": "string",
      "tiktok": "string",
      "yelp": "string"
    },
    "heroCopy": "string|null",
    "services": ["string"],
    "trustSignals": ["string"],
    "confidence": 0.0,
    "sources": ["string"]
  }
}
Rules:
- Return JSON only. No markdown.
- Use null or empty arrays/objects when unknown.
- confidence must be a number from 0 to 1.
- Favor investor-relevant details such as referral fit, lead source potential, signs of active inventory, and why a rep should contact them.
Business Name: ${name}
Phone: ${phone}
Address: ${address}`;

  const text = await callGeminiText(prompt, geminiApiKey);
  const parsed = parseJsonFromModelResponse(text);
  const normalized = normalizeResearchResult({ name, phone }, parsed);

  if (!text.trim()) {
    return {
      ...normalized,
      summary: "AI Research timeout or quota limit reached.",
    };
  }

  return normalized;
}

export async function runLeadResearch(input: { name: string; phone?: string | null; address?: string | null }): Promise<LeadEnrichmentPayload> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  return researchLeadWithGemini(input.name, input.phone ?? "N/A", input.address ?? "N/A", geminiApiKey);
}


export type ScrapeDiagnostics = {
  queriesAttempted: number;
  textSearchOkCount: number;
  textSearchErrorCount: number;
  detailsOkCount: number;
  detailsErrorCount: number;
  detailsLookupCount: number;
  stoppedEarly: boolean;
  timeBudgetExceeded: boolean;
  leadCapReached: boolean;
  skippedByRating: number;
  skippedByDedupe: number;
};

export async function scrapeLeads({
  city,
  businessType,
  minRating = 0,
  includeNoWebsiteOnly = false,
  investorCategory = "DISTRESSED_SELLERS",
  targetPropertyType = "",
}: ScrapeOptions): Promise<{ leads: Omit<Lead, "id" | "updatedAt" | "status">[]; diagnostics: ScrapeDiagnostics }> {
  const mapsApiKey = process.env.MAPS_API_KEY;
  if (!mapsApiKey) {
    throw new Error("MAPS_API_KEY is required to scrape leads with Google Places API.");
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const fakeWebsiteDomains = [
    "facebook.com",
    "yelp.com",
    "yellowpages.com",
    "bbb.org",
    "angi.com",
    "houzz.com",
    "instagram.com",
    "manta.com",
    "homeadvisor.com",
    "porch.com",
    "thumbtack.com",
  ];

  const seenPlaceIds = new Set<string>();
  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();
  const leads: Omit<Lead, "id" | "updatedAt" | "status">[] = [];
  const diagnostics: ScrapeDiagnostics = {
    queriesAttempted: 0,
    textSearchOkCount: 0,
    textSearchErrorCount: 0,
    detailsOkCount: 0,
    detailsErrorCount: 0,
    detailsLookupCount: 0,
    stoppedEarly: false,
    timeBudgetExceeded: false,
    leadCapReached: false,
    skippedByRating: 0,
    skippedByDedupe: 0,
  };

  const querySeed = `${businessType} in ${city} for ${investorCategory.replaceAll("_", " ").toLowerCase()}${targetPropertyType ? ` targeting ${targetPropertyType}` : ""}`;
  const queries = await generateMicroQueries(querySeed, investorCategory, city, businessType, targetPropertyType, geminiApiKey);
  const startedAt = Date.now();

  const isRuntimeBudgetExceeded = () => Date.now() - startedAt >= SCRAPE_RUNTIME_BUDGET_MS;

  for (const query of queries) {
    if (isRuntimeBudgetExceeded()) {
      diagnostics.stoppedEarly = true;
      diagnostics.timeBudgetExceeded = true;
      break;
    }

    diagnostics.queriesAttempted += 1;
    let params = new URLSearchParams({ query, key: mapsApiKey });
    let pageCount = 0;

    while (pageCount < MAX_RESULTS_PAGES_PER_QUERY) {
      if (isRuntimeBudgetExceeded()) {
        diagnostics.stoppedEarly = true;
        diagnostics.timeBudgetExceeded = true;
        break;
      }

      const searchJson = await fetchSearchPage(params);
      if (!searchJson) {
        diagnostics.textSearchErrorCount += 1;
        break;
      }

      const status = searchJson.status ?? "";
      if (status === "INVALID_REQUEST" && params.has("pagetoken")) {
        await sleep(4000);
        continue;
      }

      if (status !== "OK" && status !== "ZERO_RESULTS") {
        diagnostics.textSearchErrorCount += 1;
        break;
      }

      diagnostics.textSearchOkCount += 1;

      pageCount += 1;
      const results = searchJson.results ?? [];
      if (!results.length) break;

      for (const place of results) {
        if (isRuntimeBudgetExceeded()) {
          diagnostics.stoppedEarly = true;
          diagnostics.timeBudgetExceeded = true;
          break;
        }

        if (leads.length >= MAX_LEADS_PER_RUN) {
          diagnostics.stoppedEarly = true;
          diagnostics.leadCapReached = true;
          break;
        }

        if (diagnostics.detailsLookupCount >= MAX_PLACE_DETAILS_LOOKUPS_PER_RUN) {
          diagnostics.stoppedEarly = true;
          break;
        }

        if (!place.place_id || seenPlaceIds.has(place.place_id)) {
          diagnostics.skippedByDedupe += 1;
          continue;
        }
        seenPlaceIds.add(place.place_id);
        diagnostics.detailsLookupCount += 1;

        const detailsParams = new URLSearchParams({
          place_id: place.place_id,
          fields: "name,formatted_address,website,formatted_phone_number,rating,user_ratings_total,reviews",
          key: mapsApiKey,
        });

        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams.toString()}`;
        const detailsJson = await fetchJsonWithTimeout<GooglePlaceDetailsResponse>(detailsUrl, 12000);
        if (!detailsJson || detailsJson.status !== "OK" || !detailsJson.result) {
          diagnostics.detailsErrorCount += 1;
          continue;
        }
        diagnostics.detailsOkCount += 1;

        const details = detailsJson.result;
        const website = (details.website ?? "").toLowerCase();
        const hasRealWebsite = Boolean(website) && !fakeWebsiteDomains.some((domain) => website.includes(domain));

        if (includeNoWebsiteOnly && hasRealWebsite) continue;

        const name = (details.name ?? "N/A").trim();
        const phone = details.formatted_phone_number ?? "N/A";
        const normalizedName = name.toLowerCase();
        const normalizedPhone = cleanPhoneNumber(phone);

        if (seenNames.has(normalizedName)) {
          diagnostics.skippedByDedupe += 1;
          continue;
        }
        if (normalizedPhone && seenPhones.has(normalizedPhone)) {
          diagnostics.skippedByDedupe += 1;
          continue;
        }

        seenNames.add(normalizedName);
        if (normalizedPhone) seenPhones.add(normalizedPhone);

        const rating = details.rating ?? 0;
        const reviewCount = details.user_ratings_total ?? 0;
        if (rating < minRating) {
          diagnostics.skippedByRating += 1;
          continue;
        }

        const investorProfile = buildInvestorLeadProfile({
          investorCategory,
          targetPropertyType,
          query,
          businessType,
          hasRealWebsite,
          rating,
          reviewCount,
          name,
          city,
        });

        leads.push({
          businessName: name,
          city,
          businessType,
          phone,
          email: null,
          websiteUrl: details.website ?? null,
          websiteStatus: hasRealWebsite ? "LIVE" : "MISSING",
          socialLinks: [],
          aiResearchSummary: null,
          investorProfile,
          sourceQuery: query,
          ownerId: null,
          deployedUrl: null,
          siteStatus: "UNBUILT",
        });
      }

      const nextPageToken = searchJson.next_page_token;
      if (diagnostics.stoppedEarly) break;
      if (nextPageToken && results.length === 20) {
        await sleep(4000);
        params = new URLSearchParams({ pagetoken: nextPageToken, key: mapsApiKey });
      } else {
        break;
      }
    }

    if (diagnostics.stoppedEarly) break;
  }

  return { leads, diagnostics };
}
