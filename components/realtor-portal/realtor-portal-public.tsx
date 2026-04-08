"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Download, ExternalLink, Home, Mail, MapPin, MessageSquareMore, Phone, ShieldCheck } from "lucide-react";
import type { RealtorPortal } from "@/lib/types";

type RealtorPortalPublicProps = {
  leadId: string;
  token: string;
};

type PortalResponse = {
  lead: {
    id: string;
    businessName: string;
    city: string;
  };
  portal: RealtorPortal;
};

function formatDateTime(value?: string | null) {
  if (!value) return "Not scheduled yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not set";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function walkthroughTone(status: RealtorPortal["walkthrough"]["status"]) {
  if (status === "CONFIRMED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "RESCHEDULE_REQUESTED") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

export function RealtorPortalPublic({ leadId, token }: RealtorPortalPublicProps) {
  const [data, setData] = useState<PortalResponse | null>(null);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "reschedule" | "view-cma">("");
  const [requestMessage, setRequestMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPortal() {
      if (!token.trim()) {
        setError("This portal link is missing its access token.");
        return;
      }

      const response = await fetch(`/api/realtor-portal/${leadId}?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as (PortalResponse & { error?: string }) | null;

      if (!active) return;

      if (!response.ok || !payload?.portal || !payload?.lead) {
        setError(payload?.error || "This portal is unavailable.");
        return;
      }

      setData({ lead: payload.lead, portal: payload.portal });
    }

    void loadPortal();

    return () => {
      active = false;
    };
  }, [leadId, token]);

  const walkthroughStatusLabel = useMemo(() => {
    if (!data) return "";
    if (data.portal.walkthrough.status === "CONFIRMED") return "Walkthrough confirmed";
    if (data.portal.walkthrough.status === "RESCHEDULE_REQUESTED") return "Reschedule requested";
    return "Confirmation pending";
  }, [data]);

  const runAction = async (action: "confirm_walkthrough" | "request_reschedule" | "mark_cma_viewed", nextBusy: "" | "confirm" | "reschedule" | "view-cma") => {
    setBusyAction(nextBusy);
    setFeedback("");

    try {
      const response = await fetch(`/api/realtor-portal/${leadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          message: requestMessage || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { portal?: RealtorPortal; error?: string } | null;
      if (!response.ok || !payload?.portal || !data) {
        throw new Error(payload?.error || "Unable to update portal.");
      }

      setData({ ...data, portal: payload.portal });
      setFeedback(action === "confirm_walkthrough" ? "Walkthrough confirmed." : action === "request_reschedule" ? "Reschedule request sent." : "CMA marked as viewed.");
      if (action !== "mark_cma_viewed") {
        setRequestMessage("");
      }
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : "Unable to update portal.");
    } finally {
      setBusyAction("");
    }
  };

  if (error) {
    return <div className="rounded-[2rem] border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">Loading portal...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(135deg,rgba(9,9,11,0.98),rgba(17,24,39,0.96))] p-6 shadow-2xl shadow-black/30">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Realtor Portal</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{data.portal.propertyAddress || data.lead.businessName}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-zinc-300"><MapPin className="h-4 w-4 text-zinc-500" />{data.lead.city || "Property details in CRM"}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
              This workspace is your single handoff point for walkthrough confirmation, CMA review, and feedback back to acquisitions.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${walkthroughTone(data.portal.walkthrough.status)}`}>
                {walkthroughStatusLabel}
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-zinc-300">
                {data.portal.cma.url ? "CMA package attached" : "CMA pending"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Walkthrough</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{formatDateTime(data.portal.walkthrough.scheduledAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Brokerage</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{data.portal.brokerage || "Independent"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Agent</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{data.portal.realtorName || "Assigned contact"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Portal Access</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-zinc-100"><ShieldCheck className="h-5 w-5 text-emerald-300" />Secure link active</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-sky-300" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">Walkthrough Coordination</p>
                <p className="text-sm text-zinc-400">{formatDateTime(data.portal.walkthrough.scheduledAt)}</p>
              </div>
            </div>
            {data.portal.portalNote ? <p className="mt-4 text-sm leading-6 text-zinc-300">{data.portal.portalNote}</p> : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => void runAction("confirm_walkthrough", "confirm")}
                disabled={busyAction !== ""}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busyAction === "confirm" ? "Confirming..." : "Confirm walkthrough"}
              </button>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Clock3 className="h-4 w-4 text-zinc-500" />Current status</p>
                <p className="mt-2 text-sm text-zinc-400">{walkthroughStatusLabel}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><MessageSquareMore className="h-4 w-4 text-zinc-500" />Need a different time?</p>
              <textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder="Share a preferred time window, access issue, or note for acquisitions."
                className="mt-3 min-h-24 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
              />
              <button
                onClick={() => void runAction("request_reschedule", "reschedule")}
                disabled={busyAction !== ""}
                className="mt-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === "reschedule" ? "Sending..." : "Request reschedule"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 1</p>
              <p className="mt-3 text-base font-semibold text-zinc-100">Confirm the time</p>
              <p className="mt-2 text-sm text-zinc-400">Let the team know the walkthrough slot works or send a change request.</p>
            </div>
            <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 2</p>
              <p className="mt-3 text-base font-semibold text-zinc-100">Review the CMA</p>
              <p className="mt-2 text-sm text-zinc-400">Open the comp package and pressure-test value, condition, and list strategy.</p>
            </div>
            <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 3</p>
              <p className="mt-3 text-base font-semibold text-zinc-100">Send notes back</p>
              <p className="mt-2 text-sm text-zinc-400">Use the reschedule or feedback flow if there are lockbox, access, or pricing concerns.</p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-6">
            <p className="text-sm font-semibold text-zinc-100">Comparable Market Analysis</p>
            <p className="mt-2 text-sm text-zinc-400">
              {data.portal.cma.note || "Review the current CMA package attached for this property."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Zillow Zestimate</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{formatCurrency(data.portal.cma.zestimate)}</p>
                {data.portal.cma.zillowUrl ? (
                  <a href={data.portal.cma.zillowUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-sky-300 hover:text-sky-200">
                    Open Zillow
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Average Rent Band</p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">
                  {formatCurrency(data.portal.cma.rentLow)} / {formatCurrency(data.portal.cma.rentMedium)} / {formatCurrency(data.portal.cma.rentHigh)}
                </p>
                <p className="mt-2 text-xs text-zinc-500">Low / medium / high monthly rent range.</p>
              </div>
            </div>
            {data.portal.cma.url ? (
              <button
                onClick={async () => {
                  await runAction("mark_cma_viewed", "view-cma");
                  window.open(data.portal.cma.url ?? "", "_blank", "noopener,noreferrer");
                }}
                disabled={busyAction !== ""}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {busyAction === "view-cma" ? "Opening..." : data.portal.cma.fileName ? `Open ${data.portal.cma.fileName}` : "Open CMA"}
              </button>
            ) : (
              <p className="mt-5 text-sm text-zinc-500">The comp package will appear here once it has been attached.</p>
            )}
            {data.portal.cma.viewedAt ? <p className="mt-3 text-xs text-zinc-500">Last viewed {formatDateTime(data.portal.cma.viewedAt)}</p> : null}
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-6">
            <p className="text-sm font-semibold text-zinc-100">Contact</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              {data.portal.realtorName ? (
                <p className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-zinc-500" />
                  {data.portal.realtorName}{data.portal.brokerage ? `, ${data.portal.brokerage}` : ""}
                </p>
              ) : null}
              {data.portal.realtorEmail ? (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  {data.portal.realtorEmail}
                </p>
              ) : null}
              {data.portal.realtorPhone ? (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-zinc-500" />
                  {data.portal.realtorPhone}
                </p>
              ) : null}
            </div>
          </div>

          {feedback ? <p className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200">{feedback}</p> : null}
        </section>
      </div>
    </div>
  );
}
