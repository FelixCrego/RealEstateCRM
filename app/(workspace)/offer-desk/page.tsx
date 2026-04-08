"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDemoOfferDeskLeads } from "@/lib/investor-demo-content";
import type { InvestorLeadCategory, Lead } from "@/lib/types";

type OfferStatus = "DRAFT" | "SENT" | "COUNTERED" | "ACCEPTED" | "PASSED";

type OfferOverride = {
  amount?: string;
  expiresOn?: string;
  status?: OfferStatus;
  note?: string;
};

const OFFER_DESK_CACHE_KEY = "felix:offer-desk-overrides";
const offerStatusOptions: OfferStatus[] = ["DRAFT", "SENT", "COUNTERED", "ACCEPTED", "PASSED"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function readMoney(value?: string) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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
  return Math.round(base * multiplier / 1000) * 1000;
}

function formatCategory(lead: Lead) {
  return (lead.investorProfile?.category ?? "GENERAL").replaceAll("_", " ");
}

export default function OfferDeskPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<Record<string, OfferOverride>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(OFFER_DESK_CACHE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Record<string, OfferOverride>;
      setOverrides(parsed);
    } catch {
      window.localStorage.removeItem(OFFER_DESK_CACHE_KEY);
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

  const deskRows = useMemo(
    () =>
      displayLeads.map((lead) => {
        const override = overrides[lead.id] ?? {};
        return {
          lead,
          override,
          posture: buildPosture(lead),
          suggestedTerms: buildSuggestedTerms(lead),
          suggestedAnchor: buildSuggestedAnchor(lead),
          propertyAddress: lead.investorProfile?.propertyAddress ?? lead.realtorPortal?.propertyAddress ?? "Property address not captured yet",
          ownerName: lead.investorProfile?.ownerName ?? lead.contacts?.[0]?.name ?? "Owner/contact not captured",
          status: override.status ?? "DRAFT",
          amount: override.amount ?? "",
          expiresOn: override.expiresOn ?? "",
          note: override.note ?? "",
        };
      }),
    [displayLeads, overrides],
  );

  const stats = useMemo(() => {
    const active = deskRows.filter((row) => row.status === "SENT" || row.status === "COUNTERED").length;
    const countered = deskRows.filter((row) => row.status === "COUNTERED").length;
    const accepted = deskRows.filter((row) => row.status === "ACCEPTED").length;
    const expiringSoon = deskRows.filter((row) => {
      if (!row.expiresOn) return false;
      const expiresAt = new Date(`${row.expiresOn}T23:59:59`);
      const diffMs = expiresAt.getTime() - Date.now();
      return diffMs >= 0 && diffMs <= 1000 * 60 * 60 * 48;
    }).length;

    return { active, countered, accepted, expiringSoon };
  }, [deskRows]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-zinc-100">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Acquisitions Ops</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Offer Desk</h1>
        <p className="mt-2 text-sm text-zinc-400">Track live offer posture, sent ranges, expirations, and counter states across your best acquisition opportunities.</p>
        <p className="mt-3 text-xs text-zinc-500">Desk inputs are cached locally until offer economics are persisted in the CRM.</p>
        {showingDemoContent ? <p className="mt-3 text-xs text-sky-300">Showing built-in demo opportunities because no live offer candidates are available yet.</p> : null}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Active Offers</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.active}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Countered</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.countered}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Accepted</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.accepted}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Expiring in 48h</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.expiringSoon}</p>
        </article>
      </section>

      {loading ? <p className="text-sm text-zinc-400">Loading offer desk...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Offer Queue</h2>
            <p className="mt-1 text-sm text-zinc-400">Highest-scoring off-market and distressed opportunities rise to the top.</p>
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
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="pb-3">Lead</th>
                  <th className="pb-3">Asset</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Offer Posture</th>
                  <th className="pb-3">Suggested Anchor</th>
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
