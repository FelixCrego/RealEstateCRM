"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDemoBuyerProfiles, buildDemoOfferDeskLeads } from "@/lib/investor-demo-content";
import type { BuyerProfile, InvestorLeadCategory, Lead } from "@/lib/types";

type OfferStatus = "DRAFT" | "SENT" | "COUNTERED" | "ACCEPTED" | "PASSED";
type BuyerMatchFit = "STRONG" | "WORKABLE" | "WEAK";

type OfferOverride = {
  amount?: string;
  expiresOn?: string;
  status?: OfferStatus;
  note?: string;
};

type BuyerProfileDraft = {
  name: string;
  company: string;
  email: string;
  phone: string;
  markets: string;
  assetTypes: string;
  strategies: string;
  minPrice: string;
  maxPrice: string;
  minLeadScore: string;
  notes: string;
};

type BuyerMatch = {
  buyer: BuyerProfile;
  score: number;
  fit: BuyerMatchFit;
  reasons: string[];
};

type OfferDeskRow = {
  lead: Lead;
  override: OfferOverride;
  posture: string;
  suggestedTerms: string;
  suggestedAnchor: number;
  propertyAddress: string;
  ownerName: string;
  status: OfferStatus;
  amount: string;
  expiresOn: string;
  note: string;
  allBuyerMatches: BuyerMatch[];
  buyerMatches: BuyerMatch[];
};

const OFFER_DESK_CACHE_KEY = "felix:offer-desk-overrides";
const BUYER_PROFILE_STORAGE_KEY = "felix:buyer-profiles";
const offerStatusOptions: OfferStatus[] = ["DRAFT", "SENT", "COUNTERED", "ACCEPTED", "PASSED"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCompactCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "Open";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function readMoney(value?: string) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index);
}

function isOfferableCategory(category?: InvestorLeadCategory | null) {
  if (!category) return false;
  return [
    "DISTRESSED_SELLER",
    "OFF_MARKET_LIST",
    "PROBATE_ATTORNEY",
    "EVICTION_ATTORNEY",
    "PROPERTY_MANAGER",
    "GENERAL",
  ].includes(category);
}

function buildPosture(lead: Lead) {
  const score = lead.investorProfile?.leadScore ?? 0;
  const category = lead.investorProfile?.category ?? "GENERAL";

  if (category === "DISTRESSED_SELLER" || category === "OFF_MARKET_LIST") {
    return score >= 80 ? "Fast-close cash posture" : "Discovery-first cash posture";
  }
  if (category === "PROBATE_ATTORNEY" || category === "EVICTION_ATTORNEY") {
    return "Referral-driven consultation";
  }
  if (category === "PROPERTY_MANAGER") {
    return "Owner pain-point follow-up";
  }
  return "General acquisition posture";
}

function buildSuggestedTerms(lead: Lead) {
  const score = lead.investorProfile?.leadScore ?? 0;
  if (score >= 85) return "7-day close, minimal contingencies";
  if (score >= 70) return "14-day close, inspection contingency";
  if (score >= 55) return "Exploratory verbal offer";
  return "Qualify before pricing";
}

function buildSuggestedAnchor(lead: Lead) {
  const score = lead.investorProfile?.leadScore ?? 0;
  const base = lead.closedDealValue && lead.closedDealValue > 0 ? lead.closedDealValue : 125000;
  const multiplier = score >= 85 ? 0.88 : score >= 70 ? 0.82 : score >= 55 ? 0.76 : 0.68;
  return Math.round((base * multiplier) / 1000) * 1000;
}

function formatCategory(lead: Lead) {
  return (lead.investorProfile?.category ?? "GENERAL").replaceAll("_", " ");
}

function createBuyerDraft(): BuyerProfileDraft {
  return {
    name: "",
    company: "",
    email: "",
    phone: "",
    markets: "",
    assetTypes: "",
    strategies: "",
    minPrice: "",
    maxPrice: "",
    minLeadScore: "",
    notes: "",
  };
}

function normalizeBuyerProfile(raw: unknown): BuyerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.name !== "string") return null;

  const normalizeList = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry, index, array) => entry.length > 0 && array.findIndex((candidate) => candidate.toLowerCase() === entry.toLowerCase()) === index)
      : [];

  const maybeNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const updatedAtSource = typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString();
  const updatedAt = Number.isNaN(new Date(updatedAtSource).getTime()) ? new Date().toISOString() : updatedAtSource;

  return {
    id: input.id,
    name: input.name.trim(),
    company: typeof input.company === "string" ? input.company.trim() || null : null,
    email: typeof input.email === "string" ? input.email.trim() || null : null,
    phone: typeof input.phone === "string" ? input.phone.trim() || null : null,
    markets: normalizeList(input.markets),
    assetTypes: normalizeList(input.assetTypes),
    strategies: normalizeList(input.strategies),
    minPrice: maybeNumber(input.minPrice),
    maxPrice: maybeNumber(input.maxPrice),
    minLeadScore: maybeNumber(input.minLeadScore),
    notes: typeof input.notes === "string" ? input.notes.trim() || null : null,
    updatedAt,
  };
}

function fuzzyListMatch(list: string[], candidateBlob: string) {
  const normalizedBlob = normalizeText(candidateBlob);
  if (!normalizedBlob) return undefined;
  return list.find((item) => {
    const normalizedItem = normalizeText(item);
    return normalizedItem.length > 0 && (normalizedBlob.includes(normalizedItem) || normalizedItem.includes(normalizedBlob));
  });
}

function deriveDealStrategies(lead: Lead) {
  const strategies = new Set<string>();
  const category = lead.investorProfile?.category ?? "GENERAL";
  const targetPropertyType = normalizeText(lead.investorProfile?.targetPropertyType);
  const tags = (lead.investorProfile?.tags ?? []).map((tag) => normalizeText(tag));

  if (category === "DISTRESSED_SELLER" || category === "OFF_MARKET_LIST") {
    strategies.add("flip");
    strategies.add("value-add");
    strategies.add("wholesale");
  }
  if (category === "PROPERTY_MANAGER") {
    strategies.add("buy and hold");
  }
  if (targetPropertyType.includes("rental") || tags.some((tag) => tag.includes("tenant") || tag.includes("vacant"))) {
    strategies.add("buy and hold");
  }
  if (!strategies.size) strategies.add("general acquisition");

  return Array.from(strategies);
}

function scoreBuyerMatch(buyer: BuyerProfile, lead: Lead, suggestedAnchor: number): BuyerMatch {
  const reasons: string[] = [];
  let score = 0;

  const marketBlob = [lead.city, lead.investorProfile?.propertyAddress, lead.realtorPortal?.propertyAddress].filter(Boolean).join(" ");
  const matchedMarket = fuzzyListMatch(buyer.markets, marketBlob);
  if (buyer.markets.length === 0) {
    score += 6;
  } else if (matchedMarket) {
    score += 32;
    reasons.push(`Market fit: ${matchedMarket}`);
  }

  const assetBlob = [lead.investorProfile?.targetPropertyType, lead.businessType].filter(Boolean).join(" ");
  const matchedAsset = fuzzyListMatch(buyer.assetTypes, assetBlob);
  if (buyer.assetTypes.length === 0) {
    score += 6;
  } else if (matchedAsset) {
    score += 22;
    reasons.push(`Asset fit: ${matchedAsset}`);
  }

  const strategies = deriveDealStrategies(lead);
  const matchedStrategy = buyer.strategies.find((strategy) =>
    strategies.some((dealStrategy) => normalizeText(dealStrategy).includes(normalizeText(strategy)) || normalizeText(strategy).includes(normalizeText(dealStrategy))),
  );
  if (buyer.strategies.length === 0) {
    score += 6;
  } else if (matchedStrategy) {
    score += 18;
    reasons.push(`Strategy fit: ${matchedStrategy}`);
  }

  const minPrice = typeof buyer.minPrice === "number" ? buyer.minPrice : null;
  const maxPrice = typeof buyer.maxPrice === "number" ? buyer.maxPrice : null;
  if (minPrice === null && maxPrice === null) {
    score += 6;
  } else {
    const aboveMin = minPrice === null || suggestedAnchor >= minPrice;
    const belowMax = maxPrice === null || suggestedAnchor <= maxPrice;
    if (aboveMin && belowMax) {
      score += 18;
      reasons.push(`Budget fit: ${formatCompactCurrency(suggestedAnchor)}`);
    } else {
      const nearestEdge = Math.min(
        minPrice === null ? Number.POSITIVE_INFINITY : Math.abs(suggestedAnchor - minPrice),
        maxPrice === null ? Number.POSITIVE_INFINITY : Math.abs(suggestedAnchor - maxPrice),
      );
      if (Number.isFinite(nearestEdge) && nearestEdge <= suggestedAnchor * 0.15) {
        score += 8;
        reasons.push("Budget is close");
      }
    }
  }

  const leadScore = lead.investorProfile?.leadScore ?? 0;
  const minLeadScore = typeof buyer.minLeadScore === "number" ? buyer.minLeadScore : null;
  if (minLeadScore === null) {
    score += 6;
  } else if (leadScore >= minLeadScore) {
    score += 10;
    reasons.push(`Lead score clears ${minLeadScore}+`);
  } else if (leadScore + 5 >= minLeadScore) {
    score += 4;
    reasons.push("Near score threshold");
  }

  if (lead.phone || lead.contacts?.length) {
    score += 5;
    reasons.push("Contact path available");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const fit: BuyerMatchFit = boundedScore >= 75 ? "STRONG" : boundedScore >= 55 ? "WORKABLE" : "WEAK";

  return {
    buyer,
    score: boundedScore,
    fit,
    reasons: reasons.slice(0, 3),
  };
}

function fitClasses(fit: BuyerMatchFit) {
  if (fit === "STRONG") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (fit === "WORKABLE") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

export default function OfferDeskPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<Record<string, OfferOverride>>({});
  const [buyerProfiles, setBuyerProfiles] = useState<BuyerProfile[]>(() => buildDemoBuyerProfiles());
  const [buyerDraft, setBuyerDraft] = useState<BuyerProfileDraft>(() => createBuyerDraft());
  const [buyerError, setBuyerError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawOverrides = window.localStorage.getItem(OFFER_DESK_CACHE_KEY);
    if (rawOverrides) {
      try {
        const parsed = JSON.parse(rawOverrides) as Record<string, OfferOverride>;
        setOverrides(parsed);
      } catch {
        window.localStorage.removeItem(OFFER_DESK_CACHE_KEY);
      }
    }

    const rawProfiles = window.localStorage.getItem(BUYER_PROFILE_STORAGE_KEY);
    if (!rawProfiles) return;

    try {
      const parsed = JSON.parse(rawProfiles);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.map(normalizeBuyerProfile).filter((profile): profile is BuyerProfile => Boolean(profile));
      setBuyerProfiles(normalized);
    } catch {
      window.localStorage.removeItem(BUYER_PROFILE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLeads() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/leads?scope=all", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { leads?: Lead[]; error?: string } | null;
        if (!response.ok || !Array.isArray(payload?.leads)) {
          throw new Error(payload?.error || "Failed to load leads for the offer desk.");
        }
        if (isMounted) setLeads(payload.leads);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load leads for the offer desk.");
          setLeads([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadLeads();
    return () => {
      isMounted = false;
    };
  }, []);

  const offerableLeads = useMemo(
    () =>
      leads
        .filter((lead) => String(lead.status ?? "").toUpperCase() !== "CLOSED" && String(lead.status ?? "").toUpperCase() !== "DISQUALIFIED")
        .filter((lead) => isOfferableCategory(lead.investorProfile?.category) || Boolean(lead.investorProfile?.propertyAddress || lead.realtorPortal?.propertyAddress))
        .sort((first, second) => (second.investorProfile?.leadScore ?? 0) - (first.investorProfile?.leadScore ?? 0)),
    [leads],
  );
  const displayLeads = useMemo(() => (offerableLeads.length ? offerableLeads : buildDemoOfferDeskLeads()), [offerableLeads]);
  const showingDemoContent = offerableLeads.length === 0;
  const showingSeedBuyerProfiles = buyerProfiles.length > 0 && buyerProfiles.every((profile) => profile.id.startsWith("demo-buyer-"));

  const deskRows = useMemo<OfferDeskRow[]>(
    () =>
      displayLeads.map((lead) => {
        const override = overrides[lead.id] ?? {};
        const suggestedAnchor = buildSuggestedAnchor(lead);
        const allBuyerMatches = buyerProfiles
          .map((buyer) => scoreBuyerMatch(buyer, lead, suggestedAnchor))
          .sort((first, second) => second.score - first.score);

        return {
          lead,
          override,
          posture: buildPosture(lead),
          suggestedTerms: buildSuggestedTerms(lead),
          suggestedAnchor,
          propertyAddress: lead.investorProfile?.propertyAddress ?? lead.realtorPortal?.propertyAddress ?? "Property address not captured yet",
          ownerName: lead.investorProfile?.ownerName ?? lead.contacts?.[0]?.name ?? "Owner/contact not captured",
          status: override.status ?? "DRAFT",
          amount: override.amount ?? "",
          expiresOn: override.expiresOn ?? "",
          note: override.note ?? "",
          allBuyerMatches,
          buyerMatches: allBuyerMatches.slice(0, 3),
        };
      }),
    [buyerProfiles, displayLeads, overrides],
  );

  const buyerInsights = useMemo(
    () =>
      buyerProfiles.map((profile) => {
        const matches = deskRows
          .map((row) => ({
            lead: row.lead,
            propertyAddress: row.propertyAddress,
            match: row.allBuyerMatches.find((candidate) => candidate.buyer.id === profile.id) ?? null,
          }))
          .filter((entry): entry is { lead: Lead; propertyAddress: string; match: BuyerMatch } => Boolean(entry.match))
          .sort((first, second) => second.match.score - first.match.score);

        const strong = matches.filter((entry) => entry.match.fit === "STRONG").length;
        const workable = matches.filter((entry) => entry.match.fit !== "WEAK").length;

        return {
          profile,
          strong,
          workable,
          topMatch: matches[0] ?? null,
        };
      }),
    [buyerProfiles, deskRows],
  );

  const stats = useMemo(() => {
    const active = deskRows.filter((row) => row.status === "SENT" || row.status === "COUNTERED").length;
    const countered = deskRows.filter((row) => row.status === "COUNTERED").length;
    const expiringSoon = deskRows.filter((row) => {
      if (!row.expiresOn) return false;
      const expiresAt = new Date(`${row.expiresOn}T23:59:59`);
      const diffMs = expiresAt.getTime() - Date.now();
      return diffMs >= 0 && diffMs <= 1000 * 60 * 60 * 48;
    }).length;
    const strongBuyerFits = deskRows.filter((row) => row.allBuyerMatches.some((match) => match.fit === "STRONG")).length;
    const buyerReadyProfiles = buyerInsights.filter((insight) => insight.strong >= 2).length;

    return {
      active,
      countered,
      accepted: deskRows.filter((row) => row.status === "ACCEPTED").length,
      expiringSoon,
      strongBuyerFits,
      buyerReadyProfiles,
    };
  }, [buyerInsights, deskRows]);

  const persistOverride = (leadId: string, patch: OfferOverride) => {
    setOverrides((previous) => {
      const next = {
        ...previous,
        [leadId]: {
          ...previous[leadId],
          ...patch,
        },
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OFFER_DESK_CACHE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const persistBuyerProfiles = (nextProfiles: BuyerProfile[]) => {
    setBuyerProfiles(nextProfiles);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BUYER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
    }
  };

  const handleCreateBuyerProfile = () => {
    setBuyerError("");
    const name = buyerDraft.name.trim();
    const markets = parseCommaList(buyerDraft.markets);

    if (!name) {
      setBuyerError("Buyer name is required.");
      return;
    }

    if (!markets.length) {
      setBuyerError("Add at least one target market to make the buy box usable.");
      return;
    }

    const minPrice = readMoney(buyerDraft.minPrice);
    const maxPrice = readMoney(buyerDraft.maxPrice);
    const minLeadScore = buyerDraft.minLeadScore.trim() ? Number(buyerDraft.minLeadScore) : null;

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      setBuyerError("Minimum price cannot be higher than maximum price.");
      return;
    }

    if (minLeadScore !== null && (!Number.isFinite(minLeadScore) || minLeadScore < 0 || minLeadScore > 100)) {
      setBuyerError("Minimum lead score must be between 0 and 100.");
      return;
    }

    const nextProfile: BuyerProfile = {
      id: `buyer-${Date.now()}`,
      name,
      company: buyerDraft.company.trim() || null,
      email: buyerDraft.email.trim() || null,
      phone: buyerDraft.phone.trim() || null,
      markets,
      assetTypes: parseCommaList(buyerDraft.assetTypes),
      strategies: parseCommaList(buyerDraft.strategies),
      minPrice,
      maxPrice,
      minLeadScore: minLeadScore === null ? null : Math.round(minLeadScore),
      notes: buyerDraft.notes.trim() || null,
      updatedAt: new Date().toISOString(),
    };

    persistBuyerProfiles([nextProfile, ...buyerProfiles]);
    setBuyerDraft(createBuyerDraft());
  };

  const handleDeleteBuyerProfile = (buyerId: string) => {
    persistBuyerProfiles(buyerProfiles.filter((profile) => profile.id !== buyerId));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-zinc-100">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Acquisitions Ops</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Offer Desk</h1>
        <p className="mt-2 text-sm text-zinc-400">Track live offer posture, price anchors, and counter states while matching each deal against active buyer buy boxes.</p>
        <p className="mt-3 text-xs text-zinc-500">Buyer profiles and desk inputs are cached locally until they are promoted into CRM-backed records.</p>
        {showingDemoContent ? <p className="mt-3 text-xs text-sky-300">Showing built-in demo opportunities because no live offer candidates are available yet.</p> : null}
        {showingSeedBuyerProfiles ? <p className="mt-2 text-xs text-amber-300">Seed buyer profiles are loaded so you can start matching deals immediately. Add your own buyers to replace them.</p> : null}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Active Offers</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.active}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Strong Buyer Fits</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.strongBuyerFits}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Buyer Profiles</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{buyerProfiles.length}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Buyer Ready</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.buyerReadyProfiles}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Countered</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.countered}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Expiring in 48h</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.expiringSoon}</p>
        </article>
      </section>

      {loading ? <p className="text-sm text-zinc-400">Loading offer desk...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Buyer Profiles</h2>
              <p className="mt-1 text-sm text-zinc-400">Track who is buying what, where, and at what price before you send dispo or offer packages.</p>
            </div>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{buyerProfiles.length} buyers</span>
          </div>

          {!buyerProfiles.length ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
              No buyer profiles yet. Add your first profile on the right to start scoring deals against a real buy box.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {buyerInsights.map((insight) => (
                <article key={insight.profile.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-zinc-100">{insight.profile.name}</p>
                      <p className="mt-1 text-sm text-zinc-400">{insight.profile.company || "Independent buyer"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBuyerProfile(insight.profile.id)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-rose-500 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                    <p>{insight.profile.email || "No email on file"}</p>
                    <p>{insight.profile.phone || "No phone on file"}</p>
                    <p>
                      Budget {formatCompactCurrency(insight.profile.minPrice)} to {formatCompactCurrency(insight.profile.maxPrice)}
                    </p>
                    <p>Minimum lead score {insight.profile.minLeadScore ?? "Any"}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {insight.profile.markets.map((market) => (
                      <span key={`${insight.profile.id}-market-${market}`} className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
                        {market}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {insight.profile.assetTypes.map((assetType) => (
                      <span key={`${insight.profile.id}-asset-${assetType}`} className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200">
                        {assetType}
                      </span>
                    ))}
                    {insight.profile.strategies.map((strategy) => (
                      <span key={`${insight.profile.id}-strategy-${strategy}`} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                        {strategy}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Strong Fits</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-100">{insight.strong}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Workable Fits</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-100">{insight.workable}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Top Match</p>
                    {insight.topMatch ? (
                      <>
                        <p className="mt-2 font-medium text-zinc-100">{insight.topMatch.lead.businessName}</p>
                        <p className="mt-1 text-sm text-zinc-400">{insight.topMatch.propertyAddress}</p>
                        <p className="mt-2 text-xs text-zinc-500">{insight.topMatch.match.reasons.join(" • ")}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-400">No meaningful matches yet.</p>
                    )}
                  </div>

                  {insight.profile.notes ? <p className="mt-4 text-sm text-zinc-400">{insight.profile.notes}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">Add Buyer Profile</h2>
            <p className="mt-1 text-sm text-zinc-400">Capture the buyer’s market, asset type, strategy, and budget so the desk can rank them against live deals.</p>
          </div>

          {buyerError ? <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{buyerError}</p> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={buyerDraft.name}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Buyer name"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <input
              value={buyerDraft.company}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, company: event.target.value }))}
              placeholder="Company"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <input
              value={buyerDraft.email}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <input
              value={buyerDraft.phone}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <input
              value={buyerDraft.markets}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, markets: event.target.value }))}
              placeholder="Markets: Phoenix, Mesa, Scottsdale"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2"
            />
            <input
              value={buyerDraft.assetTypes}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, assetTypes: event.target.value }))}
              placeholder="Asset types: single family, rental"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2"
            />
            <input
              value={buyerDraft.strategies}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, strategies: event.target.value }))}
              placeholder="Strategies: flip, buy and hold, wholesale"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2"
            />
            <input
              value={buyerDraft.minPrice}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, minPrice: event.target.value }))}
              placeholder="Min price"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <input
              value={buyerDraft.maxPrice}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, maxPrice: event.target.value }))}
              placeholder="Max price"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <input
              value={buyerDraft.minLeadScore}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, minLeadScore: event.target.value }))}
              placeholder="Min lead score"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
            />
            <textarea
              value={buyerDraft.notes}
              onChange={(event) => setBuyerDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes: proof of funds timing, preferred rehab scope, title requirements, close speed"
              className="min-h-32 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreateBuyerProfile}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500"
            >
              Save Buyer Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setBuyerError("");
                setBuyerDraft(createBuyerDraft());
              }}
              className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Offer Queue</h2>
            <p className="mt-1 text-sm text-zinc-400">Highest-scoring acquisition opportunities with the best buyer-fit signals rise to the top.</p>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{deskRows.length} opportunities</span>
        </div>

        {!loading && deskRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
            No offerable leads yet. Import off-market lists or run distressed-seller sourcing from the scrape workspace.
          </div>
        ) : null}

        {deskRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1780px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="pb-3">Lead</th>
                  <th className="pb-3">Asset</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Offer Posture</th>
                  <th className="pb-3">Suggested Anchor</th>
                  <th className="pb-3">Buyer Matches</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Offer Amount</th>
                  <th className="pb-3">Expires</th>
                  <th className="pb-3">Notes</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deskRows.map((row) => {
                  const parsedAmount = readMoney(row.amount);
                  return (
                    <tr key={row.lead.id} className="border-t border-zinc-800 align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-zinc-100">{row.lead.businessName}</p>
                        <p className="mt-1 text-xs text-zinc-500">{row.ownerName}</p>
                        <p className="mt-1 text-xs text-zinc-500">Score {row.lead.investorProfile?.leadScore ?? 0}/100</p>
                      </td>
                      <td className="py-3 pr-3 text-zinc-300">
                        <p>{row.propertyAddress}</p>
                        <p className="mt-1 text-xs text-zinc-500">{row.lead.city || "Unknown market"}</p>
                      </td>
                      <td className="py-3 pr-3 text-zinc-300">{formatCategory(row.lead)}</td>
                      <td className="py-3 pr-3 text-zinc-300">
                        <p>{row.posture}</p>
                        <p className="mt-1 text-xs text-zinc-500">{row.suggestedTerms}</p>
                      </td>
                      <td className="py-3 pr-3 text-zinc-300">
                        <p className="font-medium text-zinc-100">{formatCurrency(row.suggestedAnchor)}</p>
                        <p className="mt-1 text-xs text-zinc-500">Heuristic anchor from lead score</p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="space-y-2">
                          {row.buyerMatches.length ? (
                            row.buyerMatches.map((match) => (
                              <div key={`${row.lead.id}-${match.buyer.id}`} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-zinc-100">{match.buyer.company || match.buyer.name}</p>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${fitClasses(match.fit)}`}>
                                    {match.fit} {match.score}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-zinc-500">{match.buyer.name}</p>
                                <p className="mt-2 text-xs text-zinc-400">{match.reasons.join(" • ") || "Manual review needed"}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500">No buyer profiles yet.</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          value={row.status}
                          onChange={(event) => persistOverride(row.lead.id, { status: event.target.value as OfferStatus })}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                        >
                          {offerStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          value={row.amount}
                          onChange={(event) => persistOverride(row.lead.id, { amount: event.target.value })}
                          placeholder={String(row.suggestedAnchor)}
                          className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                        />
                        <p className="mt-1 text-xs text-zinc-500">{parsedAmount ? formatCurrency(parsedAmount) : "No amount set"}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="date"
                          value={row.expiresOn}
                          onChange={(event) => persistOverride(row.lead.id, { expiresOn: event.target.value })}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <textarea
                          value={row.note}
                          onChange={(event) => persistOverride(row.lead.id, { note: event.target.value })}
                          placeholder={row.lead.investorProfile?.recommendedAction || "Add counter context, seller pain point, or follow-up terms"}
                          className="min-h-24 w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-2">
                          {showingDemoContent ? (
                            <Link
                              href="/scrape"
                              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                            >
                              Open Scrape
                            </Link>
                          ) : (
                            <Link
                              href={`/leads/${row.lead.id}`}
                              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                            >
                              Open Lead
                            </Link>
                          )}
                          {row.lead.phone && !showingDemoContent ? (
                            <a
                              href={`tel:${row.lead.phone}`}
                              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                            >
                              Call Owner
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
